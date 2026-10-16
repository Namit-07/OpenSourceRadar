import { NextResponse } from "next/server";
import { getGithubAccessToken, getGithubId } from "@/lib/session";
import { listSyncableSavedIssues, updateSavedIssue } from "@/lib/db";
import { findReferencingPullRequests } from "@/lib/github";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { ISSUE_STATUSES } from "@/utils/constants";

export const dynamic = "force-dynamic";

const STATUS_RANK = new Map(
  ISSUE_STATUSES.map((entry, index) => [entry.value, index])
);

/**
 * POST /api/saved-issues/sync-pr-status
 *
 * Auto-detects a contributor's pull requests from GitHub and advances their
 * tracker. GitHub's issue timeline exposes `cross-referenced` events whose
 * source is a pull request, so when a PR *authored by the signed-in user*
 * references a saved issue, the pipeline moves:
 *
 *   saved / working  →  pr-submitted   (PR open, or closed-but-unmerged)
 *                   →  merged          (PR has a merged_at timestamp)
 *
 * The detected PR URL is stored too (only when the issue has none yet, so a
 * manually-entered link is never clobbered).
 *
 * Safety rails:
 *   - Only issues still in the pipeline (saved/working) are checked, so the
 *     sync never downgrades a manually-advanced status.
 *   - Each checked issue costs one upstream GitHub API call, so the route is
 *     throttled (6 requests / 30 min / user) and capped at 10 issues per call.
 *   - A single issue's lookup failure never aborts the rest.
 */
export async function POST(request) {
  const githubId = await getGithubId(request);

  if (!githubId) {
    return NextResponse.json(
      { error: "Sign in with GitHub to sync saved issues.", signInRequired: true },
      { status: 401 }
    );
  }

  const token = await getGithubAccessToken(request);
  if (!token?.accessToken || !token?.login) {
    return NextResponse.json(
      {
        error: "GitHub access token unavailable. Reconnect GitHub.",
        requiresReauth: true,
      },
      { status: 401 }
    );
  }

  const syncLimit = rateLimit(`prsync:${githubId}`, {
    limit: 6,
    windowMs: 30 * 60_000,
  });
  if (!syncLimit.success) {
    return tooManyRequests(syncLimit.resetAt - Date.now());
  }

  const MAX_ISSUES = 10;
  let issues;
  try {
    issues = await listSyncableSavedIssues(githubId, MAX_ISSUES);
  } catch {
    return NextResponse.json(
      { error: "Unable to load saved issues." },
      { status: 500 }
    );
  }

  const updated = [];

  for (const issue of issues) {
    try {
      const repoFullName = deriveRepoFullName(issue.repository_url);
      if (!repoFullName || !issue.number) {
        continue;
      }

      const prs = await findReferencingPullRequests(
        repoFullName,
        issue.number,
        token
      );
      // Only the signed-in user's own PRs advance the tracker.
      const mine = prs.find((pr) => pr.login === token.login);
      if (!mine) {
        continue;
      }

      const nextStatus = mine.merged_at ? "merged" : "pr-submitted";
      const currentRank = STATUS_RANK.get(issue.status) ?? 0;
      const nextRank = STATUS_RANK.get(nextStatus) ?? currentRank;
      // Never downgrade (e.g. a reverted PR must not pull status backwards).
      if (nextRank <= currentRank) {
        continue;
      }

      const item = await updateSavedIssue(githubId, issue.id, {
        status: nextStatus,
        pr_url: issue.pr_url || mine.html_url,
      });
      if (item) {
        updated.push(item);
      }
    } catch {
      // A single issue's lookup must not abort the whole sync.
    }
  }

  return NextResponse.json({ checked: issues.length, updated });
}

/** "https://api.github.com/repos/owner/repo" -> "owner/repo" (or null). */
function deriveRepoFullName(repositoryUrl) {
  if (typeof repositoryUrl !== "string") {
    return null;
  }
  const match = repositoryUrl.match(/\/repos\/([^/]+\/[^/]+)$/);
  return match ? match[1] : null;
}
