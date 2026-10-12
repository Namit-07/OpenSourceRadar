import { NextResponse } from "next/server";
import { getGithubId } from "@/lib/session";
import { removeSavedIssue } from "@/lib/db";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/saved-issues/[id] -> unsave one issue for the current user.
 * Scoped by the signed-in GitHub id, so one user can never remove another's.
 */
export async function DELETE(request, { params }) {
  const githubId = await getGithubId(request);

  if (!githubId) {
    return NextResponse.json(
      { error: "Sign in with GitHub to manage saved issues.", signInRequired: true },
      { status: 401 }
    );
  }

  // Share the write budget with POST so deleting can't be used to bypass it.
  const writeLimit = rateLimit(`write:${githubId}`, { limit: 30, windowMs: 60_000 });
  if (!writeLimit.success) {
    return tooManyRequests(writeLimit.resetAt - Date.now());
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "An issue id is required." }, { status: 400 });
  }

  try {
    const removed = await removeSavedIssue(githubId, id);
    return NextResponse.json({ removed });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to remove issue." },
      { status: 500 }
    );
  }
}
