"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import FilterSidebar from "@/components/FilterSidebar";
import IssueList from "@/components/IssueList";
import { searchIssues } from "@/lib/github";

export default function Home() {
  const [issues, setIssues] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [monochromeMode, setMonochromeMode] = useState(false);
  const [bridgeVisible, setBridgeVisible] = useState(false);
  const [filters, setFilters] = useState({
    keyword: "",
    language: "",
    labels: ["good first issue"],
    noAssignees: true,
    updatedWithinDays: "30",
    sortBy: "updated",
    perPage: 30,
    page: 1,
  });
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const requestIdRef = useRef(0);
  const bridgeRef = useRef(null);

  const activeFilters = useMemo(
    () => ({
      ...filters,
      keyword: debouncedKeyword,
    }),
    [filters, debouncedKeyword]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedKeyword(filters.keyword.trim());
    }, 350);

    return () => clearTimeout(timeout);
  }, [filters.keyword]);

  useEffect(() => {
    async function fetchIssues() {
      const currentRequestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const data = await searchIssues(activeFilters);
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        setIssues(data.items || []);
        setTotalCount(data.total_count || 0);
      } catch (err) {
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        setError(err.message);
        setIssues([]);
        setTotalCount(0);
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    fetchIssues();
  }, [
    activeFilters,
    refreshTick,
  ]);

  useEffect(() => {
    const target = bridgeRef.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setBridgeVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.25,
      }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, []);

  const handleFilterChange = (newFilters) => {
    setFilters((prev) => {
      const isPageOnlyChange = Object.keys(newFilters).length === 1 && "page" in newFilters;

      return {
        ...prev,
        ...newFilters,
        page: isPageOnlyChange ? newFilters.page : 1,
      };
    });
  };

  const handleResetFilters = () => {
    setFilters({
      keyword: "",
      language: "",
      labels: ["good first issue"],
      noAssignees: true,
      updatedWithinDays: "30",
      sortBy: "updated",
      perPage: 30,
      page: 1,
    });
  };

  const handleRetry = () => {
    setRefreshTick((tick) => tick + 1);
  };

  const handleRefresh = () => {
    setRefreshTick((tick) => tick + 1);
  };

  return (
    <div className={monochromeMode ? "mono-mode" : ""}>
      <Header />
      <main>
        <section className="landing-hero">
          <div className="shell landing-grid">
            <div className="landing-copy motion-up">
              <p className="landing-kicker motion-delay-1">Spring / Summer' 26</p>
              <h2 className="landing-title motion-delay-2">Open source, curated for open source devs.</h2>
              <p className="landing-subtitle motion-delay-3">
                OpenSource Radar helps you discover contribution-ready issues the way premium retail helps
                you discover your next look: clear, elegant, and intentional.
              </p>
              <div className="landing-actions motion-delay-4">
                <a href="#catalog" className="button-solid">Shop issues</a>
                <a href="#story" className="button-ghost">Our story</a>
                <button
                  type="button"
                  onClick={() => setMonochromeMode((value) => !value)}
                  className="button-ghost"
                >
                  {monochromeMode ? "Color mode" : "Monochrome mode"}
                </button>
              </div>
            </div>
            <div className="landing-visual motion-up motion-delay-2" aria-hidden="true">
              <div className="landing-visual-main">
                <div className="campaign-card campaign-card--main">
                  <p className="campaign-eyebrow">Collection 01</p>
                  <h3 className="campaign-title">Contributor Essentials</h3>
                  <p className="campaign-copy">Good first issue, no assignee, updated this week.</p>
                  <div className="campaign-metrics">
                    <span>1204 live</span>
                    <span>92% open</span>
                  </div>
                </div>
                <div className="floating-pill pill-a">
                  <span className="pill-label">good first issue</span>
                  <span className="pill-preview">Perfect for first OSS contribution · 1.2k live</span>
                </div>
                <div className="floating-pill pill-b">
                  <span className="pill-label">help wanted</span>
                  <span className="pill-preview">Maintainers actively reviewing PRs · Fast feedback</span>
                </div>
                <div className="floating-pill pill-c">
                  <span className="pill-label">up for grabs</span>
                  <span className="pill-preview">No assignee by default · Great for quick wins</span>
                </div>
              </div>
              <div className="landing-visual-side">
                <div className="doodle-cluster" aria-hidden="true">
                  <div className="doodle-circle"></div>
                  <div className="doodle-wave"></div>
                  <div className="doodle-zig"></div>
                  <div className="doodle-note">open source radar</div>
                </div>
                <div className="campaign-card campaign-card--side">
                  <p className="campaign-eyebrow">Collection 02</p>
                  <h3 className="campaign-title">Fresh Drops</h3>
                  <p className="campaign-copy">Updated in last 30 days across curated repositories.</p>
                </div>
                <div className="campaign-ticker">
                  <span>JavaScript</span>
                  <span>TypeScript</span>
                  <span>Python</span>
                  <span>Rust</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-collections" id="story">
          <div className="shell collections-grid">
            <article className="collection-card motion-up motion-delay-1">
              <p className="collection-kicker">The Edit</p>
              <h3 className="collection-title">Good first picks, every day</h3>
              <p className="collection-copy">
                We continuously sort for freshness, beginner-friendliness, and availability so you start with
                momentum, not confusion.
              </p>
            </article>
            <article className="collection-card motion-up motion-delay-2">
              <p className="collection-kicker">The Fit</p>
              <h3 className="collection-title">Filter by language and pace</h3>
              <p className="collection-copy">
                Tailor your search by language, recency, and issue status to match your skill level and time.
              </p>
            </article>
            <article className="collection-card collection-card--contrast motion-up motion-delay-3">
              <p className="collection-kicker">The Drop</p>
              <h3 className="collection-title">Premium issue discovery starts here</h3>
              <a href="#catalog" className="collection-link">Enter catalog</a>
            </article>
          </div>
        </section>

        <section className="hero" ref={bridgeRef}>
          <div className="shell hero-shell">
            <div className={`hero-split hero-split--reveal ${bridgeVisible ? "is-visible" : ""}`}>
              <div className="hero-lead">
                <p className="hero-kicker">Catalog introduction</p>
                <h2 className="hero-title">Shop for your next open source contribution.</h2>
              </div>

              <div className="hero-side">
                <p className="hero-copy">
                  Discover active beginner-friendly issues with the calm, curated feeling of a premium catalog.
                  Filter by language, activity, and availability to find the right fit in seconds.
                </p>
                <div className="hero-tags">
                  <span className="hero-tag">Curated</span>
                  <span className="hero-tag">No assignee first</span>
                  <span className="hero-tag">Freshly active</span>
                </div>
                <div className="hero-metrics">
                  <div className="hero-metric-card">
                    <span className="hero-metric-value">1,000+</span>
                    <span className="hero-metric-label">Active open issues</span>
                  </div>
                  <div className="hero-metric-card">
                    <span className="hero-metric-value">30+</span>
                    <span className="hero-metric-label">Popular languages</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="catalog" id="catalog">
          <div className="shell catalog-grid">
            <aside>
              <FilterSidebar
                filters={filters}
                onFilterChange={handleFilterChange}
                onResetFilters={handleResetFilters}
              />
            </aside>
            <section>
              <IssueList
                issues={issues}
                loading={loading}
                error={error}
                totalCount={totalCount}
                currentPage={filters.page}
                perPage={filters.perPage}
                onPageChange={(page) => handleFilterChange({ page })}
                onRetry={handleRetry}
                onRefresh={handleRefresh}
              />
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
