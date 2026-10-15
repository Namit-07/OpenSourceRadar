"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "osr-theme";
const DARK_CLASS = "dark-mode";

/**
 * Header dark-mode toggle. Persists to localStorage, falls back to the OS
 * `prefers-color-scheme` on first visit, and applies the class to
 * <html> so theming kicks in before React hydration styles settle.
 */
export default function ThemeToggle() {
  // SSR always renders the light label; the real (stored/OS) value is read
  // after mount. This keeps server and client HTML identical and avoids a
  // hydration mismatch — the beforeInteractive script in layout.js already
  // set the correct class on <html>, so there is no theme flash either.
  const [theme, setTheme] = useState("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        setTheme(stored);
      } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
      }
    } catch {
      // Private-mode storage failures: fall back to light, still toggleable.
    }
    setMounted(true);
  }, []);

  // Keep <html> in sync once the client value is known.
  useEffect(() => {
    if (mounted) {
      document.documentElement.classList.toggle(DARK_CLASS, theme === "dark");
    }
  }, [theme, mounted]);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle(DARK_CLASS, next === "dark");
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal: the toggle still works for this session.
    }
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className="theme-toggle"
      // Before mount the true theme is unknown (SSR always renders light),
      // so keep the layout slot without a misleading icon flash.
      // suppressHydrationWarning: after mount the stored/OS theme may differ
      // from the SSR light label — expected, not an error.
      suppressHydrationWarning
      style={mounted ? undefined : { visibility: "hidden" }}
    >
      <span aria-hidden="true" className="theme-toggle-icon">
        {isDark ? "☾" : "☀"}
      </span>
      <span className="theme-toggle-label">{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}
