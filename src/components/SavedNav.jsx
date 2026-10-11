"use client";

import Link from "next/link";
import { useSavedIssuesContext } from "@/context/SavedIssuesContext";

/**
 * Header link to the saved-issues page, with a live count badge. Client-only
 * because it reads the localStorage-backed saved store.
 */
export default function SavedNav() {
  const { savedCount, hydrated } = useSavedIssuesContext();

  return (
    <Link href="/saved" className="saved-nav">
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
        <path
          d="M6 3h12a1 1 0 0 1 1 1v16.2a.8.8 0 0 1-1.24.67L12 17.5l-4.76 3.37A.8.8 0 0 1 6 20.2V4a1 1 0 0 1 1-1z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      <span>Saved</span>
      {/* Only show the badge after hydration to avoid a mismatch, and only when
          there is something to show. */}
      {hydrated && savedCount > 0 && (
        <span className="saved-nav-badge">{savedCount}</span>
      )}
    </Link>
  );
}
