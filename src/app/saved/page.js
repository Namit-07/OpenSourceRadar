"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import IssueCard from "@/components/IssueCard";
import SignInGate from "@/components/SignInGate";
import { useSavedIssuesContext } from "@/context/SavedIssuesContext";

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

  const sessionReady = sessionStatus !== "loading";
  const signedIn = sessionStatus === "authenticated";
  const showGate = sessionReady && !signedIn;

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
                        Saved on this device. Browse the catalog and tap “Save” to add more.
                      </span>
                    </p>
                  </div>
                  <Link href="/" className="button-ghost">
                    Back to catalog
                  </Link>
                </div>

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
                ) : (
                  <div className="issue-list">
                    {savedIssues.map((issue, index) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        variant={getVariant(index)}
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
