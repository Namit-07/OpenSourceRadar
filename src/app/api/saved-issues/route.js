import { NextResponse } from "next/server";
import { getGithubId } from "@/lib/session";
import { listSavedIssues, saveIssue } from "@/lib/db";
import { sanitizeTrackerFields, validateIssuePayload } from "@/lib/validateIssue";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Saved-issues API, keyed by the signed-in user's stable GitHub id.
 *
 * Every route is gated: without a session we return 401 and never touch the
 * database, mirroring the no-anonymous-access rule used by /api/issues.
 */

// GET /api/saved-issues -> the current user's saved issues
export async function GET(request) {
  const githubId = await getGithubId(request);

  if (!githubId) {
    return NextResponse.json(
      { error: "Sign in with GitHub to view saved issues.", signInRequired: true },
      { status: 401 }
    );
  }

  // Throttle reads per user (60/min). Cheap protection against a hammering client.
  const readLimit = rateLimit(`read:${githubId}`, { limit: 60, windowMs: 60_000 });
  if (!readLimit.success) {
    return tooManyRequests(readLimit.resetAt - Date.now());
  }

  try {
    return NextResponse.json({ items: await listSavedIssues(githubId) });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load saved issues." },
      { status: 500 }
    );
  }
}

// POST /api/saved-issues { issue } -> save (or re-save) one issue
export async function POST(request) {
  const githubId = await getGithubId(request);

  if (!githubId) {
    return NextResponse.json(
      { error: "Sign in with GitHub to save issues.", signInRequired: true },
      { status: 401 }
    );
  }

  // Throttle writes per user (30/min) — a user shouldn't need to save faster.
  const writeLimit = rateLimit(`write:${githubId}`, { limit: 30, windowMs: 60_000 });
  if (!writeLimit.success) {
    return tooManyRequests(writeLimit.resetAt - Date.now());
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const issue = validateIssuePayload(body?.issue);
  if (!issue) {
    return NextResponse.json(
      { error: "A valid issue payload is required." },
      { status: 400 }
    );
  }

  // Tracker fields ride along on the issue payload but are sanitized
  // tolerantly: catalog-shaped data may carry none (defaults apply) or
  // stale ones (fall back to safe values) without failing the save.
  const tracker = sanitizeTrackerFields(body?.issue?.status, body?.issue?.notes);

  try {
    const saved = await saveIssue(githubId, { ...issue, ...tracker });
    return NextResponse.json({ item: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to save issue." },
      { status: 500 }
    );
  }
}

