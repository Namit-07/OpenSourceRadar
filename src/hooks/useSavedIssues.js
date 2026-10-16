"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Client hook that owns the "saved issues" state, now backed by the
 * server-side database via /api/saved-issues (see src/lib/db.js).
 *
 * Flow:
 *   - On sign-in (and whenever the session changes), fetch the saved list.
 *   - Save/unsave update the UI optimistically, then reconcile with the server.
 *   - On sign-out, the local list is cleared immediately.
 *
 * Because this lives in a shared context provider, every component (catalog
 * save buttons, header count, /saved page) reads the same in-memory list and
 * stays in sync within a session.
 */
export function useSavedIssues() {
  const { status: sessionStatus } = useSession();
  const signedIn = sessionStatus === "authenticated";

  const [savedIssues, setSavedIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  // Guards against overlapping PR-sync requests (e.g. /saved mounting twice).
  const syncInFlightRef = useRef(false);

  // Load the saved list whenever the user is signed in; clear it otherwise.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!signedIn) {
        setSavedIssues([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch("/api/saved-issues", {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error("Failed to load saved issues");
        }

        const payload = await response.json();
        if (!cancelled) {
          setSavedIssues(payload?.items ?? []);
        }
      } catch {
        // Fail soft: an empty list is safer than a crash. The UI still works,
        // just without persisted saves until the next successful load.
        if (!cancelled) {
          setSavedIssues([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const savedIds = useMemo(
    () => new Set(savedIssues.map((issue) => issue.id)),
    [savedIssues]
  );

  const toggleSave = useCallback(
    async (issue) => {
      const exists = savedIds.has(issue.id);

      // Optimistic update: flip state immediately, reconcile with the server.
      setSavedIssues((prev) =>
        exists
          ? prev.filter((item) => item.id !== issue.id)
          : [issue, ...prev]
      );

      try {
        if (exists) {
          const response = await fetch(`/api/saved-issues/${issue.id}`, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error("Failed to remove");
        } else {
          const response = await fetch("/api/saved-issues", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ issue }),
          });
          if (!response.ok) throw new Error("Failed to save");
          // Replace the optimistic entry with the server's canonical record.
          const payload = await response.json();
          if (payload?.item) {
            setSavedIssues((prev) => [
              payload.item,
              ...prev.filter((item) => item.id !== issue.id),
            ]);
          }
        }
      } catch {
        // Roll back on failure so the UI reflects the true server state.
        setSavedIssues((prev) =>
          exists ? [issue, ...prev] : prev.filter((item) => item.id !== issue.id)
        );
      }
    },
    [savedIds]
  );

  const unsaveIssue = useCallback(async (id) => {
    setSavedIssues((prev) => prev.filter((item) => item.id !== id));

    try {
      await fetch(`/api/saved-issues/${id}`, { method: "DELETE" });
    } catch {
      // Roll back by reloading is overkill here; leave removal optimistic.
    }
  }, []);

  const isSaved = useCallback((id) => savedIds.has(id), [savedIds]);

  /**
   * Update one saved issue's tracker fields (`status`, `notes` and/or
   * `pr_url`) with an optimistic local write, reconciled against the server
   * response and rolled back on failure — the same pattern as toggleSave.
   *
   * @param {number|string} id - The saved issue's GitHub id.
   * @param {{ status?: string, notes?: string, pr_url?: string }} updates
   * @returns {Promise<boolean>} Whether the server accepted the update.
   */
  const updateSavedIssue = useCallback(
    async (id, updates) => {
      if (!updates || typeof updates !== "object") {
        return false;
      }

      const hasStatus = updates.status !== undefined;
      const hasNotes = updates.notes !== undefined;
      const hasPrUrl = updates.pr_url !== undefined;

      if (!hasStatus && !hasNotes && !hasPrUrl) {
        return false;
      }

      let previous = null;

      setSavedIssues((prev) =>
        prev.map((item) => {
          if (item.id !== id) {
            return item;
          }
          previous = item;
          return {
            ...item,
            ...(hasStatus ? { status: updates.status } : null),
            ...(hasNotes ? { notes: updates.notes } : null),
            ...(hasPrUrl ? { pr_url: updates.pr_url } : null),
          };
        })
      );

      if (!previous) {
        return false;
      }

      try {
        const response = await fetch(`/api/saved-issues/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(hasStatus ? { status: updates.status } : null),
            ...(hasNotes ? { notes: updates.notes } : null),
            ...(hasPrUrl ? { pr_url: updates.pr_url } : null),
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update");
        }

        const payload = await response.json();
        if (payload?.item) {
          // Replace the optimistic entry with the server's canonical record.
          setSavedIssues((prev) =>
            prev.map((item) => (item.id === id ? payload.item : item))
          );
        }
        return true;
      } catch {
        // Roll back to the pre-update snapshot so the UI reflects truth.
        setSavedIssues((prev) =>
          prev.map((item) => (item.id === id ? previous : item))
        );
        return false;
      }
    },
    []
  );

  /**
   * Ask the server to detect PRs for saved issues that are still in the
   * pipeline (saved / working) and auto-advance their status to
   * pr-submitted / merged. The server does the GitHub lookups; this merges
   * any updated records back into the shared store so the UI (tracker, pills,
   * filters) reflects the new state everywhere.
   *
   * @returns {Promise<object[]>} The issues whose status/link changed.
   */
  const syncSavedIssues = useCallback(async () => {
    if (syncInFlightRef.current) {
      return [];
    }
    syncInFlightRef.current = true;
    try {
      const response = await fetch("/api/saved-issues/sync-pr-status", {
        method: "POST",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return [];
      }

      const payload = await response.json();
      const updatedItems = payload?.updated ?? [];

      if (updatedItems.length > 0) {
        setSavedIssues((prev) => {
          const byId = new Map(updatedItems.map((item) => [item.id, item]));
          return prev.map((item) => byId.get(item.id) ?? item);
        });
      }

      return updatedItems;
    } catch {
      return [];
    } finally {
      syncInFlightRef.current = false;
    }
  }, []);

  return {
    savedIssues,
    savedIds,
    savedCount: savedIssues.length,
    loading,
    // `hydrated` kept for backward compatibility with existing consumers.
    hydrated: !loading,
    toggleSave,
    unsaveIssue,
    isSaved,
    updateSavedIssue,
    syncSavedIssues,
  };
}


