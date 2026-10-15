/**
 * Validation helpers for the saved-issues API.
 *
 * The client sends an `issue` payload on POST that we persist. We don't trust
 * it: without validation a user could store oversized strings or a crafted
 * `html_url` (e.g. a `javascript:` URL that IssueCard later renders as an href,
 * a self-XSS vector). These checks keep stored data sane and safe.
 */

import { DEFAULT_ISSUE_STATUS, ISSUE_STATUSES } from "@/utils/constants";

const MAX_TITLE_LENGTH = 500;
const MAX_URL_LENGTH = 500;
const MAX_LABELS = 20;
const MAX_ASSIGNEES = 20;
const MAX_NOTES_LENGTH = 2000;

/**
 * Validate a URL is https and on an allowed GitHub host.
 *
 * @param {unknown} value
 * @param {string[]} allowedHosts - e.g. ["github.com"] or ["github.com","api.github.com"]
 * @returns {boolean}
 */
function isSafeUrlOnHosts(value, allowedHosts) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_URL_LENGTH) {
    return false;
  }
  try {
    const url = new URL(value);
    // Only https on an allowed host. Blocks javascript:, data:, http, etc.
    return url.protocol === "https:" && allowedHosts.includes(url.hostname);
  } catch {
    return false;
  }
}

/**
 * The issue link we render as an <a href>. Must be a real github.com issue URL.
 * Kept strict because this is the one URL that becomes a clickable link.
 */
function isSafeIssueUrl(value) {
  return isSafeUrlOnHosts(value, ["github.com"]);
}

/**
 * The repository API URL. GitHub's search API returns this as
 * "https://api.github.com/repos/{owner}/{repo}" — NOT github.com — so we accept
 * the api.github.com host here too. It is only used to derive the repo name
 * (never rendered as a link), so the allowlist is still a safe boundary.
 */
function isSafeRepositoryUrl(value) {
  return isSafeUrlOnHosts(value, ["github.com", "api.github.com"]);
}

function isNonEmptyString(value, maxLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

/**
 * Validate a contribution-tracker status step.
 *
 * Server-side allowlist matching `ISSUE_STATUSES` in src/utils/constants.js.
 * Client-supplied strings are never trusted into the database directly.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidIssueStatus(value) {
  return (
    typeof value === "string" &&
    ISSUE_STATUSES.some((entry) => entry.value === value)
  );
}

/**
 * Validate + return a safe copy of a tracker-fields payload (`status`,
 * `notes`), or `null` when it fails validation.
 *
 * At least one of `status` / `notes` must be present. `notes` are plain text;
 * React escapes them on render and IssueCard never injects them as HTML, so
 * no allowlist applies — only a length cap.
 *
 * @param {unknown} updates - The raw payload from the request body.
 * @returns {{ status?: string, notes?: string }|null}
 */
export function validateTrackerUpdate(updates) {
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    return null;
  }

  const result = {};
  const hasStatus = updates.status !== undefined;
  const hasNotes = updates.notes !== undefined;

  if (!hasStatus && !hasNotes) {
    return null;
  }

  if (hasStatus) {
    if (!isValidIssueStatus(updates.status)) {
      return null;
    }
    result.status = updates.status;
  }

  if (hasNotes) {
    if (
      typeof updates.notes !== "string" ||
      updates.notes.length > MAX_NOTES_LENGTH
    ) {
      return null;
    }
    result.notes = updates.notes;
  }

  return result;
}

/**
 * Validate a saved-issue's tracker fields coming from the full issue payload
 * (e.g. a catalog issue record that already carries `status`/`notes`).
 * Invalid or missing values fall back to safe defaults instead of failing,
 * because the payload may come from GitHub-shaped data that has no tracker
 * fields at all.
 *
 * @param {unknown} status
 * @param {unknown} notes
 * @returns {{ status: string, notes: string }}
 */
export function sanitizeTrackerFields(status, notes) {
  const normalizedStatus = isValidIssueStatus(status)
    ? status
    : DEFAULT_ISSUE_STATUS;
  const normalizedNotes =
    typeof notes === "string" ? notes.slice(0, MAX_NOTES_LENGTH) : "";

  return { status: normalizedStatus, notes: normalizedNotes };
}

/**
 * Validate + return a safe copy of an issue payload, or `null` if invalid.
 *
 * @param {unknown} issue - The raw payload from the request body.
 * @returns {object|null} A sanitized issue, or null when it fails validation.
 */
export function validateIssuePayload(issue) {
  if (!issue || typeof issue !== "object") {
    return null;
  }

  // `id` must be a finite number (GitHub issue ids are numeric).
  const id = typeof issue.id === "string" ? Number(issue.id) : issue.id;
  if (!Number.isFinite(id)) {
    return null;
  }

  if (!isNonEmptyString(issue.title, MAX_TITLE_LENGTH)) {
    return null;
  }

  if (!isSafeIssueUrl(issue.html_url)) {
    return null;
  }

  // Optional repository_url, but if present it must be a safe https GitHub URL.
  let repository_url = "";
  if (issue.repository_url != null && issue.repository_url !== "") {
    if (!isSafeRepositoryUrl(issue.repository_url)) {
      return null;
    }
    repository_url = issue.repository_url;
  }

  const labels = Array.isArray(issue.labels)
    ? issue.labels.slice(0, MAX_LABELS).map((label) => ({
        id: label?.id ?? label?.name ?? null,
        name: typeof label?.name === "string" ? label.name.slice(0, 100) : "",
        color: typeof label?.color === "string" ? label.color : null,
      }))
    : [];

  const assignees = Array.isArray(issue.assignees)
    ? issue.assignees.slice(0, MAX_ASSIGNEES).map((a) => ({
        login: typeof a?.login === "string" ? a.login.slice(0, 100) : "",
      }))
    : [];

  return {
    id,
    number: Number.isFinite(Number(issue.number)) ? Number(issue.number) : null,
    title: issue.title,
    html_url: issue.html_url,
    repository_url,
    comments: Number.isFinite(Number(issue.comments)) ? Number(issue.comments) : 0,
    created_at: typeof issue.created_at === "string" ? issue.created_at : null,
    updated_at: typeof issue.updated_at === "string" ? issue.updated_at : null,
    labels,
    assignees,
  };
}
