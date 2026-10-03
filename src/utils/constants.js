export const LANGUAGES = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "Go",
  "Rust",
  "C++",
  "C#",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "Dart",
  "Scala",
  "R",
  "Shell",
  "HTML",
  "CSS",
  "Vue",
];

export const DIFFICULTY_LABELS = [
  "good first issue",
  "beginner",
  "easy",
  "help wanted",
  "up-for-grabs",
  "first-timers-only",
];

export const SORT_OPTIONS = [
  { value: "updated", label: "Recently updated" },
  { value: "created", label: "Recently created" },
  { value: "comments", label: "Most discussed" },
];

export const FRESHNESS_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "7", label: "Updated in last 7 days" },
  { value: "30", label: "Updated in last 30 days" },
  { value: "90", label: "Updated in last 90 days" },
];

export const PER_PAGE_OPTIONS = [10, 20, 30, 50];

/**
 * Curated GitHub organisations, grouped into catalog "collections".
 *
 * Why this exists: GitHub's issue search has no quality qualifier. Verified
 * against the live API — `topic:gsoc` returns 0 results (topics are a repo-search
 * qualifier), and `stars:>1000` collapses a 307,000-result query down to 27, so
 * neither can be used. Restricting by `org:` with a hand-picked allowlist is the
 * only reliable way to keep the catalog on projects that are actually worth
 * contributing to, instead of random personal repositories.
 *
 * Space separated `org:` qualifiers are OR'd by GitHub (apache=1064, mozilla=54,
 * together=1118), so one request covers a whole collection. Keep collections
 * small: GitHub rejects over-long search queries.
 */
export const CONTRIBUTION_SCOPES = [
  {
    value: "gsoc",
    label: "GSoC flagship orgs",
    blurb: "Mentor-rich projects that run GSoC programmes",
    orgs: ["apache", "mozilla", "python", "rust-lang", "kubernetes", "django", "tensorflow", "gnome"],
  },
  {
    value: "foundations",
    label: "Community foundations",
    blurb: "Long-standing, mentor-rich open source communities",
    orgs: ["apache", "mozilla", "debian", "fedora", "gnome", "kde", "libreoffice", "blender"],
  },
  {
    value: "data-ai",
    label: "Data & AI",
    blurb: "Scientific computing and machine learning ecosystems",
    orgs: ["tensorflow", "pytorch", "scikit-learn", "pandas-dev", "numpy", "huggingface", "astropy", "jupyter"],
  },
  {
    value: "infra-cloud",
    label: "Infra & cloud",
    blurb: "Cloud native tooling, orchestration and databases",
    orgs: ["kubernetes", "cncf", "prometheus", "grafana", "docker", "envoyproxy", "opentelemetry", "postgres"],
  },
  {
    value: "web-platforms",
    label: "Web platforms",
    blurb: "Frameworks and platforms the web is built on",
    orgs: ["facebook", "angular", "vuejs", "sveltejs", "nodejs", "vercel", "elastic", "mongodb"],
  },
  {
    value: "all",
    label: "All of GitHub",
    blurb: "Every repository — expect noise from tiny personal projects",
    orgs: [],
  },
];

export const DEFAULT_SCOPE = "all";

export function getContributionScope(value) {
  return (
    CONTRIBUTION_SCOPES.find((scope) => scope.value === value) ??
    CONTRIBUTION_SCOPES.find((scope) => scope.value === DEFAULT_SCOPE)
  );
}

