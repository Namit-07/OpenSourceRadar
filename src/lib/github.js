const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_SEARCH_ENDPOINT = `${GITHUB_API_BASE}/search/issues`;
const ISSUES_API_ENDPOINT = "/api/issues";

/**
 * Error thrown when the GitHub API answers with a non-2xx status.
 * Carries the upstream status so the API route can mirror it.
 */
export class GitHubApiError extends Error {
  constructor(message, { status = 500, requiresReauth = false } = {}) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.requiresReauth = requiresReauth;
  }
}

function normalizePerPage(perPage) {
  return String(Number(perPage) || 30);
}

function normalizePage(page) {
  return String(Number(page) || 1);
}

function toNumber(value) {
  if (value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Builds the GitHub search `q` value from the UI filters. */
export function buildSearchQuery(filters) {
  const { keyword, language, labels, noAssignees, updatedWithinDays, orgs } = filters;

  let query = "is:issue is:open archived:false";

  if (keyword?.trim()) {
    query += ` ${keyword.trim()}`;
  }

  // Match any selected label instead of requiring all labels.
  if (labels && labels.length > 0) {
    const labelQuery = labels.map((label) => `label:"${label}"`).join(" OR ");
    query += ` (${labelQuery})`;
  }

  // Curated allowlist. GitHub ORs repeated `org:` qualifiers, so one request can
  // cover a whole collection of quality organisations.
  if (orgs && orgs.length > 0) {
    query += ` ${orgs.map((org) => `org:${org}`).join(" ")}`;
  }

  if (language) {
    query += ` language:${language}`;
  }

  if (noAssignees) {
    query += " no:assignee";
  }

  if (updatedWithinDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(updatedWithinDays));
    query += ` updated:>=${cutoff.toISOString().split("T")[0]}`;
  }

  return query;
}

/** GitHub search params (server-side only). */
function buildGitHubSearchParams(filters) {
  const params = new URLSearchParams({
    q: buildSearchQuery(filters),
    per_page: normalizePerPage(filters.perPage),
    page: normalizePage(filters.page),
  });

  if (filters.sortBy && filters.sortBy !== "best-match") {
    params.set("sort", filters.sortBy);
  } else {
    params.set("sort", "updated");
  }

  params.set("order", "desc");

  return params;
}

/** Query string understood by our own /api/issues proxy. */
export function buildIssuesApiParams(filters) {
  const params = new URLSearchParams();

  if (filters.keyword?.trim()) {
    params.set("keyword", filters.keyword.trim());
  }

  if (filters.language) {
    params.set("language", filters.language);
  }

  (filters.labels ?? []).forEach((label) => params.append("labels", label));

  if (filters.scope) {
    params.set("scope", filters.scope);
  }

  if (filters.noAssignees) {
    params.set("noAssignees", "true");
  }

  if (filters.updatedWithinDays) {
    params.set("updatedWithinDays", String(filters.updatedWithinDays));
  }

  if (filters.sortBy) {
    params.set("sortBy", filters.sortBy);
  }

  params.set("perPage", normalizePerPage(filters.perPage));
  params.set("page", normalizePage(filters.page));

  return params;
}

/** Reads GitHub's rate limit headers into a plain, serialisable object. */
export function readRateLimit(headers) {
  const limit = toNumber(headers.get("x-ratelimit-limit"));
  const remaining = toNumber(headers.get("x-ratelimit-remaining"));
  const reset = toNumber(headers.get("x-ratelimit-reset"));

  if (limit === null || remaining === null) {
    return null;
  }

  return {
    limit,
    remaining,
    resetAt: reset === null ? null : new Date(reset * 1000).toISOString(),
  };
}

function describeGitHubError(response) {
  if (response.status === 401) {
    return "GitHub rejected your access token. Reconnect GitHub to keep searching with your account.";
  }

  if (response.status === 403 || response.status === 429) {
    return "Your GitHub token hit its search limit (30 searches per minute). Try again in a moment.";
  }

  if (response.status === 422) {
    return "GitHub rejected that search query. Try removing a filter or two.";
  }

  return `GitHub API error: ${response.status}`;
}

/**
 * Server-only: queries the GitHub search API as the signed-in user.
 *
 * A token is mandatory — there is no anonymous fallback, which is what makes
 * the catalog private to each contributor's GitHub account.
 */
export async function searchIssuesWithToken(filters, session) {
  if (!session?.accessToken) {
    throw new GitHubApiError("Sign in with GitHub to browse issues.", {
      status: 401,
    });
  }

  const params = buildGitHubSearchParams(filters);

  const headers = {
    Accept: "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "OpenSourceRadar",
    Authorization: `${session.tokenType || "bearer"} ${session.accessToken}`,
  };

  const response = await fetch(`${GITHUB_SEARCH_ENDPOINT}?${params.toString()}`, {
    headers,
    cache: "no-store",
  });

  const rateLimit = readRateLimit(response.headers);

  if (!response.ok) {
    throw new GitHubApiError(describeGitHubError(response), {
      status: response.status,
      requiresReauth: response.status === 401 || response.status === 403,
    });
  }

  const data = await response.json();
  return { data, rateLimit };
}

/**
 * Browser-facing: asks our own /api/issues proxy, which attaches the signed-in
 * user's GitHub token on the server.
 */
export async function searchIssues(filters) {
  const params = buildIssuesApiParams(filters);

  const response = await fetch(`${ISSUES_API_ENDPOINT}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      payload?.error ?? `OpenSource Radar API error: ${response.status}`
    );
    error.signInRequired = Boolean(payload?.signInRequired);
    error.requiresReauth = Boolean(payload?.requiresReauth);
    throw error;
  }

  return payload ?? { items: [], total_count: 0, rateLimit: null, authenticated: true };
}
