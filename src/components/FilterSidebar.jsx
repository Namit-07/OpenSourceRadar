import {
  DIFFICULTY_LABELS,
  FRESHNESS_OPTIONS,
  LANGUAGES,
  PER_PAGE_OPTIONS,
  SORT_OPTIONS,
} from "@/utils/constants";

export default function FilterSidebar({ filters, onFilterChange, onResetFilters }) {
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
    <div className="panel filter-panel">
      <div className="panel-header">
        <h2 className="panel-title">Filters</h2>
        <button onClick={onResetFilters} className="link-button">Reset all</button>
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
  );
}
