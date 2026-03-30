const GITHUB_API_BASE = "https://api.github.com";

export async function searchIssues(filters) {
  const {
    keyword,
    language,
    labels,
    noAssignees,
    updatedWithinDays,
    sortBy,
    perPage,
    page,
  } = filters;

  // Build the query string.
  let query = "is:issue is:open archived:false";

  if (keyword?.trim()) {
    query += ` ${keyword.trim()}`;
  }

  // Match any selected label instead of requiring all labels.
  if (labels && labels.length > 0) {
    const labelQuery = labels.map((label) => `label:\"${label}\"`).join(" OR ");
    query += ` (${labelQuery})`;
  }

  // Add language filter.
  if (language) {
    query += ` language:${language}`;
  }

  // Filter by no assignees.
  if (noAssignees) {
    query += " no:assignee";
  }

  if (updatedWithinDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(updatedWithinDays));
    const isoDate = cutoff.toISOString().split("T")[0];
    query += ` updated:>=${isoDate}`;
  }

  const normalizedPerPage = String(Number(perPage) || 30);
  const normalizedPage = String(Number(page) || 1);

  const params = new URLSearchParams({
    q: query,
    per_page: normalizedPerPage,
    page: normalizedPage,
  });

  if (sortBy && sortBy !== "best-match") {
    params.set("sort", sortBy);
    params.set("order", "desc");
  } else {
    params.set("sort", "updated");
    params.set("order", "desc");
  }

  const url = `${GITHUB_API_BASE}/search/issues?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "GitHub API rate limit exceeded. Please try again in a few minutes."
      );
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  return data;
}
