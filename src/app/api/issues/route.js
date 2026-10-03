import { NextResponse } from "next/server";
import { GitHubApiError, searchIssuesWithToken } from "@/lib/github";
import { getGithubAccessToken } from "@/lib/session";
import { getContributionScope } from "@/utils/constants";

export const dynamic = "force-dynamic";

function readFilters(searchParams) {
  return {
    keyword: searchParams.get("keyword") ?? "",
    language: searchParams.get("language") ?? "",
    labels: searchParams.getAll("labels"),
    // The curated allowlist is resolved server-side, so the client only sends a
    // short collection key instead of a long list of organisations. An unknown
    // or missing scope falls back to the default collection ("All of GitHub").
    orgs: getContributionScope(searchParams.get("scope") || undefined).orgs,
    noAssignees: searchParams.get("noAssignees") === "true",
    updatedWithinDays: searchParams.get("updatedWithinDays") ?? "",
    sortBy: searchParams.get("sortBy") ?? "best-match",
    perPage: searchParams.get("perPage") ?? 30,
    page: searchParams.get("page") ?? 1,
  };
}

/**
 * Server proxy for the GitHub search API.
 *
 * Access is gated: the visitor's own GitHub token is read from the encrypted
 * session cookie (never from the browser) and forwarded to GitHub, so every
 * search runs on the contributor's own account and quota. Without a token this
 * route refuses to call GitHub at all and answers 401, so the catalog can never
 * be served anonymously.
 */
export async function GET(request) {
  const session = await getGithubAccessToken(request);

  if (!session) {
    return NextResponse.json(
      {
        error: "Sign in with GitHub to browse issues.",
        signInRequired: true,
        requiresReauth: false,
      },
      { status: 401 }
    );
  }

  try {
    const { data, rateLimit } = await searchIssuesWithToken(
      readFilters(request.nextUrl.searchParams),
      session
    );

    return NextResponse.json({
      items: data.items ?? [],
      total_count: data.total_count ?? 0,
      incomplete_results: data.incomplete_results ?? false,
      authenticated: true,
      rateLimit,
    });
  } catch (error) {
    const isGitHubError = error instanceof GitHubApiError;

    return NextResponse.json(
      {
        error: isGitHubError ? error.message : "Unable to reach the GitHub API.",
        signInRequired: error?.status === 401 && !error?.requiresReauth,
        requiresReauth: Boolean(error?.requiresReauth),
      },
      { status: isGitHubError ? error.status : 502 }
    );
  }
}
