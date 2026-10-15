"use client";

import { useMemo } from "react";
import IssueCard from "./IssueCard";
import LoadingSkeleton from "./LoadingSkeleton";
import { useSavedIssuesContext } from "@/context/SavedIssuesContext";
import { DEFAULT_ISSUE_STATUS } from "@/utils/constants";

export default function IssueList({
  issues,
  loading,
  error,
  totalCount,
  currentPage,
  perPage,
  rateLimit = null,
  reauthRequired = false,
  onReconnect,
  onPageChange,
  onRetry,
  onRefresh,
}) {
  const startIndex = issues.length > 0 ? (currentPage - 1) * perPage + 1 : 0;
  const endIndex = issues.length > 0 ? startIndex + issues.length - 1 : 0;
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage * perPage < totalCount;
  // Fresh GitHub results carry no tracker fields, so overlay the pipeline
  // status (and notes) from the saved store. That way every saved card — in
  // the catalog, not just on /saved — shows its current step.
  const { savedIssues } = useSavedIssuesContext();
  const issuesWithTracker = useMemo(() => {
    if (!savedIssues || savedIssues.length === 0) {
      return issues;
    }
    const byId = new Map(savedIssues.map((saved) => [saved.id, saved]));
    return issues.map((issue) => {
      const saved = byId.get(issue.id);
      if (!saved) {
        return issue;
      }
      return {
        ...issue,
        status: saved.status ?? DEFAULT_ISSUE_STATUS,
        notes: saved.notes ?? "",
      };
    });
  }, [issues, savedIssues]);

  const getVariant = (index) => {
    if (index === 0) {
      return "hero";
    }

    if (index % 7 === 0 || index % 7 === 4) {
      return "editorial";
    }

    return "standard";
  };

  if (loading) {
    return (
      <div className="issue-list">
        {[...Array(5)].map((_, i) => (
          <LoadingSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel results-panel">
        <div className="state-box">
          <h3 className="state-title">Unable to load issues</h3>
          <p className="state-copy">{error}</p>
          {reauthRequired ? (
            <button onClick={onReconnect} className="button-solid">
              Reconnect GitHub
            </button>
          ) : (
            <button onClick={onRetry} className="button-solid">
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="panel results-panel">
        <div className="state-box">
          <h3 className="state-title">No issues found</h3>
          <p className="state-copy">Try changing the filters to widen your issue catalog.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel results-panel">
      <div className="results-head">
        <div className="results-head-copy">
          <p className="results-meta">
            Showing <strong>{startIndex}-{endIndex}</strong> of <strong>{totalCount}</strong> issues
          </p>
          <p className="quota-line">
            <span className="quota-chip quota-chip--token">Your GitHub token</span>
            <span className="quota-text">{buildQuotaText(rateLimit)}</span>
          </p>
        </div>
        <button onClick={onRefresh} className="button-ghost">
          Refresh
        </button>
      </div>

      <div className="issue-list">
        {issuesWithTracker.map((issue, index) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            variant={getVariant(index)}
          />
        ))}
      </div>

      <div className="pagination">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPreviousPage}
          className="button-ghost"
        >
          Previous
        </button>
        <p className="page-pill">Page {currentPage}</p>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage}
          className="button-ghost"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function buildQuotaText(rateLimit) {
  if (!rateLimit) {
    return "Searching with your GitHub token";
  }

  const remaining = Number(rateLimit.remaining ?? 0).toLocaleString("en-US");
  const limit = Number(rateLimit.limit ?? 0).toLocaleString("en-US");

  return `${remaining} of ${limit} searches left on your token this minute`;
}
