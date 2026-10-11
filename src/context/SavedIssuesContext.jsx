"use client";

import { createContext, useContext } from "react";
import { useSavedIssues } from "@/hooks/useSavedIssues";

const SavedIssuesContext = createContext(null);

/**
 * Shares a single saved-issues store across the whole app (catalog save
 * buttons, the header count badge, and the /saved page) so they never drift out
 * of sync. Mount it once near the root layout.
 *
 * Note: the underlying store (src/hooks/useSavedIssues.js) is already
 * module-level and shared, so this provider is mainly a convenience so
 * components can read the store without importing the hook directly.
 */
export function SavedIssuesProvider({ children }) {
  const value = useSavedIssues();

  return (
    <SavedIssuesContext.Provider value={value}>
      {children}
    </SavedIssuesContext.Provider>
  );
}

/**
 * Access the shared saved-issues store. Must be called inside
 * {@link SavedIssuesProvider}.
 */
export function useSavedIssuesContext() {
  const context = useContext(SavedIssuesContext);

  if (!context) {
    throw new Error(
      "useSavedIssuesContext must be used within a SavedIssuesProvider."
    );
  }

  return context;
}
