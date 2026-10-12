/**
 * Validation helpers for the saved-issues API.
 *
 * The client sends an `issue` payload on POST that we persist. We don't trust
 * it: without validation a user could store oversized strings or a crafted
 * `html_url` (e.g. a `javascript:` URL that IssueCard later renders as an href,
 * a self-XSS vector). These checks keep stored data sane and safe.
 */

const MAX_TITLE_LENGTH = 500;
const MAX_URL_LENGTH = 500;
const MAX_LABELS = 20;
const MAX_ASSIGNEES = 20;

/** A URL we're willing to store and later render as a link href. */
function isSafeGithubUrl(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_URL_LENGTH) {
    return false;
  }
  try {
    const url = new URL(value);
    // Only https GitHub issue URLs. Blocks javascript:, data:, http, etc.
    return url.protocol === "https:" && url.hostname === "github.com";
  } catch {
    return false;
  }
}

function isNonEmptyString(value, maxLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
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

  if (!isSafeGithubUrl(issue.html_url)) {
    return null;
  }

  // Optional repository_url, but if present it must be a safe https URL.
  let repository_url = "";
  if (issue.repository_url != null && issue.repository_url !== "") {
    if (!isSafeGithubUrl(issue.repository_url)) {
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
