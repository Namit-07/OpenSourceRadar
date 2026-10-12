"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  };
}


