"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import IssueCard from "@/components/IssueCard";
import SavedIssueTracker from "@/components/SavedIssueTracker";
import SignInGate from "@/components/SignInGate";
import { useSavedIssuesContext } from "@/context/SavedIssuesContext";
import { ISSUE_STATUSES, normalizeIssueStatus } from "@/utils/constants";

/**
 * A user's saved issues — the ones they've decided to work on.
 *
 * Reads the same shared store as the catalog's save buttons, so anything saved
 * while browsing shows up here immediately. Saved data now lives in the
 * server-side database (see src/lib/db.js), keyed by the signed-in GitHub
 * account, so it follows the user across devices.
 *
 * Access is gated behind sign-in, matching the catalog: the saved list is only
 * ever shown to an authenticated visitor.
 */
export default function SavedIssuesPage() {
  const { status: sessionStatus } = useSession();
  const { savedIssues, hydrated } = useSavedIssuesContext();
  const [statusFilter, setStatusFilter] = useState("all");

  const sessionReady = sessionStatus !== "loading";
  const signedIn = sessionStatus === "authenticated";
  const showGate = sessionReady && !signedIn;

  // Per-status counts for the filter chips, computed from the normalized
  // status so legacy rows (no status yet) land under "Saved".
  const statusCounts = useMemo(() => {
    const counts = { all: savedIssues.length };
    for (const entry of ISSUE_STATUSES) {
      counts[entry.value] = 0;
    }
    for (const issue of savedIssues) {
      const value = normalizeIssueStatus(issue.status);
      counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
  }, [savedIssues]);

  const visibleIssues =
    statusFilter === "all"
      ? savedIssues
      : savedIssues.filter(
          (issue) => normalizeIssueStatus(issue.status) === statusFilter
        );

  const getVariant = (index) => {
    if (index === 0) {
      return "hero";
    }
    if (index % 7 === 0 || index % 7 === 4) {
      return "editorial";
    }
    return "standard";
  };

  return (
    <div>
      <Header />
      <main>
        <section className="catalog">
          <div className="shell">
            {showGate ? (
              <div className="gate-wrap">
                <SignInGate />
              </div>
            ) : (
              <div className="panel results-panel">
                <div className="results-head">
                  <div className="results-head-copy">
                    <p className="results-meta">
                      Your saved issues
                      {hydrated && savedIssues.length > 0 && (
                        <>
                          {" "}
                          — <strong>{savedIssues.length}</strong>{" "}
                          {savedIssues.length === 1 ? "issue" : "issues"}
                        </>
                      )}
                    </p>
                    <p className="quota-line">
                      <span className="quota-text">
                        Track each issue Saved → Working on it → PR submitted → Merged, with notes on your approach.
                      </span>
                    </p>
                  </div>
                  <Link href="/" className="button-ghost">
                    Back to catalog
                  </Link>
                </div>

                {hydrated && savedIssues.length > 0 && (
                  <div
                    className="saved-filters"
                    role="group"
                    aria-label="Filter saved issues by status"
                  >
                    <button
                      type="button"
                      aria-pressed={statusFilter === "all"}
                      onClick={() => setStatusFilter("all")}
                      className={`tracker-filter ${statusFilter === "all" ? "tracker-filter--active" : ""}`}
                    >
                      All ({statusCounts.all})
                    </button>
                    {ISSUE_STATUSES.map((entry) => (
                      <button
                        key={entry.value}
                        type="button"
                        aria-pressed={statusFilter === entry.value}
                        onClick={() => setStatusFilter(entry.value)}
                        className={`tracker-filter ${statusFilter === entry.value ? "tracker-filter--active" : ""}`}
                      >
                        {entry.label} ({statusCounts[entry.value] ?? 0})
                      </button>
                    ))}
                  </div>
                )}

                {!hydrated ? (
                  <div className="issue-list">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="saved-skeleton" />
                    ))}
                  </div>
                ) : savedIssues.length === 0 ? (
                  <div className="state-box">
                    <h3 className="state-title">No saved issues yet</h3>
                    <p className="state-copy">
                      When you find an issue you want to work on, hit “Save” on its
                      card and it will show up here.
                    </p>
                    <Link href="/" className="button-solid">
                      Browse issues
                    </Link>
                  </div>
                ) : visibleIssues.length === 0 ? (
                  <div className="state-box">
                    <h3 className="state-title">No issues at this step</h3>
                    <p className="state-copy">
                      Nothing is currently marked as “
                      {statusFilter === "all"
                        ? "All"
                        : (ISSUE_STATUSES.find((entry) => entry.value === statusFilter)?.label ?? statusFilter)}
                      ”. Move an issue here from its status tracker, or clear the filter.
                    </p>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      className="button-solid"
                    >
                      Show all saved
                    </button>
                  </div>
                ) : (
                  <div className="issue-list">
                    {visibleIssues.map((issue, index) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        variant={getVariant(index)}
                        footer={<SavedIssueTracker issue={issue} />}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
