"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  SAVED_ISSUES_STORAGE_KEY,
  normalizeIssue,
  readSavedIssues,
  writeSavedIssues,
} from "@/lib/savedIssues";

/**
 * Client hook that owns the "saved issues" state.
 *
 * It reads from a module-level store (localStorage today) via
 * `useSyncExternalStore`, which is React's recommended way to subscribe to an
 * external store and is hydration-safe: the server render uses an empty
 * snapshot and the client reconciles to the stored list on the first client
 * pass, with no effect and no hydration-mismatch warning.
 *
 * Because the store is module-level, every component that calls this hook
 * shares the same data, so save buttons, the header count, and the /saved page
 * never drift out of sync.
 *
 * Swapping the backing store (e.g. to a `/api/saved-issues` backend) only
 * requires changing `readSavedIssues`/`writeSavedIssues` in src/lib and the
 * `storage` sync below — the hook's public API stays identical.
 */

const EMPTY = [];

// null means "not read from storage yet"; arrays are kept referentially stable
// between mutations so useSyncExternalStore can compare them cheaply.
let cache = null;
const listeners = new Set();

function getSnapshot() {
  if (cache === null) {
    // Client-only. On the server, useSyncExternalStore calls getServerSnapshot
    // instead, so this never touches localStorage during SSR.
    cache = readSavedIssues();
  }
  return cache;
}

function getServerSnapshot() {
  return EMPTY;
}

function commit(next) {
  cache = next;
  writeSavedIssues(next);
  listeners.forEach((listener) => listener());
}

/**
 * Wipe the saved list (memory + storage) and notify subscribers.
 *
 * Called on sign-out so one user's saved issues are never left behind for the
 * next person who signs in on the same browser.
 */
export function clearSavedIssues() {
  cache = EMPTY;
  writeSavedIssues(EMPTY);
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Keep multiple browser tabs in sync: when another tab writes the same key,
// reload from storage and notify subscribers.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === SAVED_ISSUES_STORAGE_KEY) {
      cache = readSavedIssues();
      listeners.forEach((listener) => listener());
    }
  });
}

export function useSavedIssues() {
  const savedIssues = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const savedIds = useMemo(
    () => new Set(savedIssues.map((issue) => issue.id)),
    [savedIssues]
  );

  const toggleSave = useCallback((issue) => {
    const normalized = normalizeIssue(issue);
    const exists = cache?.some((item) => item.id === normalized.id) ?? false;

    // Newest first so the saved list reads like a recent-activity feed.
    commit(exists ? cache.filter((item) => item.id !== normalized.id) : [normalized, ...cache]);
  }, []);

  const unsaveIssue = useCallback((id) => {
    commit((cache ?? []).filter((item) => item.id !== id));
  }, []);

  const isSaved = useCallback((id) => savedIds.has(id), [savedIds]);

  return {
    savedIssues,
    savedIds,
    savedCount: savedIssues.length,
    hydrated: cache !== null,
    toggleSave,
    unsaveIssue,
    isSaved,
  };
}

