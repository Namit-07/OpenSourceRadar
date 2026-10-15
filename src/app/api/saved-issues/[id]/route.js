import { NextResponse } from "next/server";
import { getGithubId } from "@/lib/session";
import { removeSavedIssue, updateSavedIssue } from "@/lib/db";
import { validateTrackerUpdate } from "@/lib/validateIssue";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Per-item saved-issue routes, scoped by the signed-in GitHub id so one user
 * can never touch another's.
 *
 *   DELETE /api/saved-issues/[id]        -> unsave one issue
 *   PATCH  /api/saved-issues/[id] {status?, notes?} -> update tracker fields
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

/**
 * PATCH /api/saved-issues/[id] -> update an issue's tracker fields.
 *
 * Body: `{ status?: "saved" | "working" | "pr-submitted" | "merged",
 *          notes?: string }`. At least one field is required. The payload is
 * allowlist/cap-validated before storage, shares the 30/min write budget
 * with POST/DELETE, and the updated record is returned so the client can
 * reconcile its optimistic update.
 */
export async function PATCH(request, { params }) {
  const githubId = await getGithubId(request);

  if (!githubId) {
    return NextResponse.json(
      { error: "Sign in with GitHub to manage saved issues.", signInRequired: true },
      { status: 401 }
    );
  }

  // Share the write budget with POST/DELETE so status updates can't be used
  // to bypass it.
  const writeLimit = rateLimit(`write:${githubId}`, { limit: 30, windowMs: 60_000 });
  if (!writeLimit.success) {
    return tooManyRequests(writeLimit.resetAt - Date.now());
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "An issue id is required." }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const updates = validateTrackerUpdate(body);
  if (!updates) {
    return NextResponse.json(
      {
        error:
          "A valid tracker update is required: status must be one of saved, working, pr-submitted, merged, and notes must be a string up to 2000 characters.",
      },
      { status: 400 }
    );
  }

  try {
    const item = await updateSavedIssue(githubId, id, updates);

    if (!item) {
      return NextResponse.json(
        { error: "Saved issue not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to update issue." },
      { status: 500 }
    );
  }
}
