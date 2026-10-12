import { useState } from "react";
import {
  CONTRIBUTION_SCOPES,
  DIFFICULTY_LABELS,
  FRESHNESS_OPTIONS,
  LANGUAGES,
  PER_PAGE_OPTIONS,
  SORT_OPTIONS,
  getContributionScope,
} from "@/utils/constants";

export default function FilterSidebar({ filters, onFilterChange, onResetFilters }) {
  const activeScope = getContributionScope(filters.scope);

  // On mobile the panel is collapsed by default so issues show first; the
  // toggle is only visible on small screens (see globals.css). Desktop always
  // renders the body open via CSS regardless of this state.
  const [open, setOpen] = useState(false);

  // A quick count of active filters for the mobile toggle label.
  const activeFilterCount =
    (filters.keyword ? 1 : 0) +
    (filters.language ? 1 : 0) +
    filters.labels.length;

  const handleScopeChange = (e) => {
    onFilterChange({ scope: e.target.value });
  };

  const handleLanguageChange = (e) => {
    onFilterChange({ language: e.target.value });
  };

  const handleKeywordChange = (e) => {
    onFilterChange({ keyword: e.target.value });
  };

  const handleSortChange = (e) => {
    onFilterChange({ sortBy: e.target.value });
  };

  const handleFreshnessChange = (e) => {
    onFilterChange({ updatedWithinDays: e.target.value });
  };

  const handlePerPageChange = (e) => {
    onFilterChange({ perPage: Number(e.target.value) });
  };

  const handleLabelToggle = (label) => {
    const newLabels = filters.labels.includes(label)
      ? filters.labels.filter((l) => l !== label)
      : [...filters.labels, label];
    onFilterChange({ labels: newLabels });
  };

  const handleNoAssigneesToggle = () => {
    onFilterChange({ noAssignees: !filters.noAssignees });
  };

  return (
    <div className={`panel filter-panel ${open ? "is-open" : ""}`}>
      <div className="panel-header">
        <h2 className="panel-title">Filters</h2>
        <div className="panel-header-actions">
          {activeFilterCount > 0 && (
            <button onClick={onResetFilters} className="link-button">
              Reset all
            </button>
          )}
          {/* Mobile-only collapse toggle. Hidden on desktop via CSS. */}
          <button
            type="button"
            className="filter-toggle"
            aria-expanded={open}
            aria-controls="filter-panel-body"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Hide" : activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="filter-panel-body" id="filter-panel-body">

      <div className="form-block">
        <label className="field-label">Collection</label>
        <select
          value={activeScope.value}
          onChange={handleScopeChange}
          className="select-input"
        >
          {CONTRIBUTION_SCOPES.map((scope) => (
            <option key={scope.value} value={scope.value}>
              {scope.label}
            </option>
          ))}
        </select>
        <p className="helper">{activeScope.blurb}</p>
      </div>

      <div className="form-block">
        <label className="field-label">Keywords</label>
        <input
          type="text"
          value={filters.keyword}
          onChange={handleKeywordChange}
          placeholder="auth bug docs cli..."
          className="text-input"
        />
        <p className="helper">Search issue title and description text</p>
      </div>

      <div className="form-block">
        <label className="field-label">Language</label>
        <select
          value={filters.language}
          onChange={handleLanguageChange}
          className="select-input"
        >
          <option value="">All Languages</option>
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>

      <div className="form-block">
        <label className="field-label">Sort by</label>
        <select
          value={filters.sortBy}
          onChange={handleSortChange}
          className="select-input"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-block">
        <label className="field-label">Freshness</label>
        <select
          value={filters.updatedWithinDays}
          onChange={handleFreshnessChange}
          className="select-input"
        >
          {FRESHNESS_OPTIONS.map((option) => (
            <option key={option.value || "any"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-block">
        <label className="field-label">Difficulty</label>
        <div className="checkbox-stack">
          {DIFFICULTY_LABELS.map((label) => (
            <label key={label} className="checkbox-row">
              <input
                type="checkbox"
                checked={filters.labels.includes(label)}
                onChange={() => handleLabelToggle(label)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-block">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={filters.noAssignees}
            onChange={handleNoAssigneesToggle}
          />
          <span>Not assigned yet</span>
        </label>
        <p className="helper">Hide issues that someone is already working on</p>
      </div>

      <div className="form-block">
        <label className="field-label">Results per page</label>
        <select
          value={filters.perPage}
          onChange={handlePerPageChange}
          className="select-input"
        >
          {PER_PAGE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      {(filters.keyword || filters.language || filters.labels.length > 0) && (
        <div className="chip-wrap">
            {filters.keyword && (
              <span className="chip">
                {filters.keyword}
                <button
                  onClick={() => onFilterChange({ keyword: "" })}
                >
                  ×
                </button>
              </span>
            )}
            {filters.language && (
              <span className="chip">
                {filters.language}
                <button
                  onClick={() => onFilterChange({ language: "" })}
                >
                  ×
                </button>
              </span>
            )}
            {filters.labels.map((label) => (
              <span key={label} className="chip">
                {label}
                <button onClick={() => handleLabelToggle(label)}>
                  ×
                </button>
              </span>
            ))}
        </div>
      )}
      </div>
    </div>
  );
}
