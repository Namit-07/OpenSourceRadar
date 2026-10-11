/**
 * Persistence layer for "saved" issues — the issues a contributor decides to
 * work on.
 *
 * Design goal: keep this module the single place that knows *where* saved
 * issues live. Today that is the browser's localStorage, which matches the
 * project's deliberately stateless, no-database design. When a backend is
 * added later, only the read/write functions below need to change (e.g. hit
 * `GET/POST/DELETE /api/saved-issues`); the React hook and every component can
 * stay exactly as they are.
 *
 * We deliberately store a *minimal* shape rather than the raw GitHub search
 * payload, which is large and mostly irrelevant here.
 */

export const SAVED_ISSUES_STORAGE_KEY = "osr:saved-issues";

/**
 * Reduce a GitHub search-API issue down to just the fields IssueCard renders,
 * plus a couple of stable identifiers for de-duplication.
 *
 * @param {object} issue - A raw issue object from the GitHub search API.
 * @returns {object} A small, JSON-serialisable issue record.
 */
export function normalizeIssue(issue) {
  return {
    id: issue.id,
    number: issue.number ?? null,
    title: issue.title ?? "",
    html_url: issue.html_url ?? "",
    repository_url: issue.repository_url ?? "",
    comments: issue.comments ?? 0,
    created_at: issue.created_at ?? null,
    updated_at: issue.updated_at ?? null,
    // Only the label fields the UI uses (id for keys, name, color for styling).
    labels: Array.isArray(issue.labels)
      ? issue.labels.map((label) => ({
          id: label.id ?? label.name,
          name: label.name ?? "",
          color: label.color ?? null,
        }))
      : [],
    // Enough to show the "N assigned" pill; IssueCard only reads `.length`.
    assignees: Array.isArray(issue.assignees) ? issue.assignees.map((a) => ({ login: a.login })) : [],
  };
}

function isSavedIssueShape(value) {
  return Boolean(value) && typeof value === "object" && value.id != null;
}

/**
 * Low-level read. Returns an empty array on any error or malformed data so a
 * corrupted localStorage entry can never crash the app.
 *
 * @returns {object[]}
 */
export function readSavedIssues() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_ISSUES_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isSavedIssueShape);
  } catch {
    return [];
  }
}

/** Low-level write of the full list. Silently ignores storage failures. */
export function writeSavedIssues(issues) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SAVED_ISSUES_STORAGE_KEY, JSON.stringify(issues));
  } catch {
    // Storage full or unavailable (e.g. private mode): fail soft.
  }
}
