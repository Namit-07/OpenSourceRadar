import { formatDistanceToNow } from "@/utils/dateUtils";

export default function IssueCard({ issue, variant = "standard" }) {
  const repoUrl = issue.repository_url;
  const repoName = repoUrl ? repoUrl.split("/").slice(-2).join("/") : "Unknown";
  const hasAssignees = issue.assignees && issue.assignees.length > 0;
  const isHero = variant === "hero";
  const isEditorial = variant === "editorial";

  return (
    <a
      href={issue.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`issue-card ${isHero ? "issue-card--hero" : ""} ${isEditorial ? "issue-card--editorial" : ""}`}
    >
      <div className="issue-card-inner">
        {isHero && <span className="featured-label">Editor pick</span>}
        {isEditorial && <span className="featured-label featured-label--soft">Curated</span>}

        <div className="issue-top">
          <span className="issue-repo">{repoName}</span>
            {!hasAssignees && (
              <span className="availability-pill availability-pill--open">
                Available
              </span>
            )}
            {hasAssignees && (
              <span className="availability-pill">
                {issue.assignees.length} assigned
              </span>
            )}
        </div>

        <h3 className="issue-title issue-title-clamp">{issue.title}</h3>

        <div className="label-row">
          {issue.labels?.slice(0, 5).map((label) => (
            <span
              key={label.id}
              className="label-chip"
              style={{ color: getContrastColor(label.color) }}
            >
              {label.name}
            </span>
          ))}
        </div>

        <div className="meta-row">
          <span className="meta-key">Opened</span>
          <span>{formatDistanceToNow(issue.created_at)}</span>
          <span className="meta-dot">•</span>
          <span className="meta-key">Updated</span>
          <span>{formatDistanceToNow(issue.updated_at)}</span>
          <span className="meta-dot">•</span>
          <span>{issue.comments} comments</span>
        </div>
      </div>
    </a>
  );
}

function getContrastColor(hexColor) {
  if (!hexColor) return "#374151";
  const r = parseInt(hexColor.substr(0, 2), 16);
  const g = parseInt(hexColor.substr(2, 2), 16);
  const b = parseInt(hexColor.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? "#1f2937" : "#374151";
}
