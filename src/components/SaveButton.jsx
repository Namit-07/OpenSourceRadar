"use client";

import { useSavedIssuesContext } from "@/context/SavedIssuesContext";

/**
 * Bookmark toggle for an issue.
 *
 * IMPORTANT: `IssueCard` is a single big `<a>` linking to GitHub, so this button
 * lives *outside* that anchor (in the card's header row) rather than nested
 * inside it — nesting a button in an anchor is invalid HTML and the click would
 * also trigger navigation. When rendered inside the card we still guard with
 * `stopPropagation`/`preventDefault` for safety.
 */
export default function SaveButton({ issue, className = "" }) {
  const { toggleSave, isSaved } = useSavedIssuesContext();
  const saved = isSaved(issue.id);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved issues" : "Save this issue"}
      title={saved ? "Saved" : "Save issue"}
      className={`save-button ${saved ? "save-button--saved" : ""} ${className}`}
      onClick={(event) => {
        // Never let the click bubble to a surrounding link/card.
        event.preventDefault();
        event.stopPropagation();
        toggleSave(issue);
      }}
    >
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
        <path
          d="M6 3h12a1 1 0 0 1 1 1v16.2a.8.8 0 0 1-1.24.67L12 17.5l-4.76 3.37A.8.8 0 0 1 6 20.2V4a1 1 0 0 1 1-1z"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      <span className="save-button-label">{saved ? "Saved" : "Save"}</span>
    </button>
  );
}
