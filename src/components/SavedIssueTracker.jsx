"use client";

import { useEffect, useRef, useState } from "react";
import { ISSUE_STATUSES, normalizeIssueStatus } from "@/utils/constants";
import { useSavedIssuesContext } from "@/context/SavedIssuesContext";

/**
 * Contribution tracker for one saved issue: a status pipeline
 * (Saved → Working on it → PR submitted → Merged) plus personal notes
 * ("why I picked this / my approach").
 *
 * Behaviour:
 *   - Status changes save immediately via PATCH.
 *   - Notes autosave ~800ms after typing stops (and on blur), so typing never
 *     fires a request per keystroke or burns the 30/min write budget.
 *   - Both update optimistically through the shared saved-issues store and
 *     roll back automatically if the server request fails.
 */

const NOTES_SAVE_DELAY_MS = 800;
const MAX_NOTES_LENGTH = 2000;

export default function SavedIssueTracker({ issue }) {
  const { updateSavedIssue } = useSavedIssuesContext();
  const status = normalizeIssueStatus(issue.status);

  const [draft, setDraft] = useState(issue.notes ?? "");
  const [saveState, setSaveState] = useState("idle");
  const dirtyRef = useRef(false);
  const timerRef = useRef(null);
  // Latest committed values, so the delayed save always writes what the user
  // actually typed — not a stale closure from when the timer was scheduled.
  const pendingRef = useRef(null);

  const activeIndex = ISSUE_STATUSES.findIndex((entry) => entry.value === status);

  // Adopt server-side notes (another tab, optimistic reconcile) whenever the
  // user isn't mid-edit. While dirty, local keystrokes win.
  useEffect(() => {
    if (!dirtyRef.current && (issue.notes ?? "") !== draft) {
      setDraft(issue.notes ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue.notes]);

  // Flush any pending autosave on unmount so edits aren't silently dropped
  // when navigating away mid-typing.
  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        const pending = pendingRef.current;
        if (pending && dirtyRef.current) {
          pendingRef.current = null;
          updateSavedIssue(issue.id, { notes: pending });
        }
      }
    },
    [issue.id, updateSavedIssue]
  );

  async function persistNotes(notes) {
    setSaveState("saving");
    pendingRef.current = null;
    const ok = await updateSavedIssue(issue.id, { notes });
    dirtyRef.current = !ok;
    setSaveState(ok ? "saved" : "error");
    return ok;
  }

  function scheduleAutosave(notes) {
    pendingRef.current = notes;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      persistNotes(notes);
    }, NOTES_SAVE_DELAY_MS);
  }

  function handleNotesChange(event) {
    const value = event.target.value.slice(0, MAX_NOTES_LENGTH);
    dirtyRef.current = true;
    setDraft(value);
    setSaveState("idle");
    scheduleAutosave(value);
  }

  function handleNotesBlur() {
    if (!dirtyRef.current) {
      return;
    }
    // Save immediately on blur so the value is committed even if the user
    // tabs away before the debounce fires.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const notes = pendingRef.current ?? draft;
    persistNotes(notes);
  }

  async function handleStatusChange(nextStatus) {
    if (nextStatus === status) {
      return;
    }
    setSaveState("saving");
    const ok = await updateSavedIssue(issue.id, { status: nextStatus });
    setSaveState(ok ? "saved" : "error");
  }

  const notesId = `tracker-notes-${issue.id}`;

  return (
    <div
      className="tracker-panel"
      onClick={(event) => {
        // The tracker sits beside the card's <a>, not inside it — but guard
        // anyway so interacting with it can never trigger navigation.
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        className="tracker-steps"
        role="group"
        aria-label={`Contribution status for ${issue.title}`}
      >
        {ISSUE_STATUSES.map((entry, index) => {
          const isActive = entry.value === status;
          const isDone = index < activeIndex;
          return (
            <button
              key={entry.value}
              type="button"
              aria-pressed={isActive}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleStatusChange(entry.value);
              }}
              className={`tracker-step ${isActive ? "tracker-step--active" : ""} ${isDone ? "tracker-step--done" : ""}`}
              title={isActive ? `Current status: ${entry.label}` : `Mark as ${entry.label}`}
            >
              <span className="tracker-step-dot" aria-hidden="true">
                {isDone ? "✓" : index + 1}
              </span>
              <span className="tracker-step-label">{entry.label}</span>
            </button>
          );
        })}
      </div>

      <div className="tracker-notes">
        <label className="tracker-notes-label" htmlFor={notesId}>
          My notes
          <span className="tracker-notes-hint"> — why I picked this / my approach</span>
        </label>
        <textarea
          id={notesId}
          className="tracker-notes-input"
          rows={3}
          maxLength={MAX_NOTES_LENGTH}
          placeholder="e.g. Picked this because it touches the search API I want to learn; plan: reproduce first, then add the failing test…"
          value={draft}
          onChange={handleNotesChange}
          onBlur={handleNotesBlur}
        />
        <div className="tracker-notes-meta">
          <span aria-live="polite" className={`tracker-save-state tracker-save-state--${saveState}`}>
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "Saved ✓"}
            {saveState === "error" && "Couldn't save — retrying keeps your text here."}
          </span>
          <span className="tracker-char-count">
            {draft.length}/{MAX_NOTES_LENGTH}
          </span>
        </div>
      </div>
    </div>
  );
}
