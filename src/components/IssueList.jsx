import IssueCard from "./IssueCard";
import LoadingSkeleton from "./LoadingSkeleton";

export default function IssueList({
  issues,
  loading,
  error,
  totalCount,
  currentPage,
  perPage,
  onPageChange,
  onRetry,
  onRefresh,
}) {
  const startIndex = issues.length > 0 ? (currentPage - 1) * perPage + 1 : 0;
  const endIndex = issues.length > 0 ? startIndex + issues.length - 1 : 0;
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage * perPage < totalCount;

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
          <button onClick={onRetry} className="button-solid">Try again</button>
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
        <p className="results-meta">
          Showing <strong>{startIndex}-{endIndex}</strong> of <strong>{totalCount}</strong> issues
        </p>
        <button onClick={onRefresh} className="button-ghost">Refresh</button>
      </div>

      <div className="issue-list">
        {issues.map((issue, index) => (
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
