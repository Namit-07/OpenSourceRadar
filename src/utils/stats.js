import { normalizeIssueStatus } from "@/utils/constants";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-10-16T10:00:00Z" -> "2026-10-16" in the *local* timezone. */
function toLocalDay(isoString) {
  if (!isoString) return null;
  // DB timestamps are stored as "YYYY-MM-DD HH:MM:SS" (UTC) by SQLite's
  // datetime('now'); convert that to strict ISO before parsing, and treat
  // bare values as UTC so Safari/old parsers don't balk.
  const normalized = String(isoString).replace(" ", "T");
  const withTz =
    normalized.includes("Z") || /[+-]\d\d:\d\d$/.test(normalized)
      ? normalized
      : `${normalized}Z`;
  const d = new Date(withTz);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" -> local midnight epoch ms (for day-diff math). */
function dayKeyToLocalMidnight(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/**
 * Contribution stats + activity streak, computed from the shared saved-issues
 * store. Pure + client-side, so it stays live as statuses change (mark an
 * issue merged and the numbers update instantly).
 *
 * Activity days are every day a saved issue was saved OR had a pipeline step
 * advanced (working / pr-submitted / merged), recorded via the per-step
 * timestamps that updateSavedIssue stamps in the database.
 *
 * - currentStreak: consecutive active days ending today (or yesterday, if
 *   today has no activity yet).
 * - bestStreak: the longest run of consecutive active days on record.
 *
 * @param {Array<object>} savedIssues
 * @returns {{
 *   total: number, working: number, prSubmitted: number, merged: number,
 *   mergedThisMonth: number, currentStreak: number, bestStreak: number
 * }}
 */
export function computeContributionStats(savedIssues) {
  const stats = {
    total: 0,
    working: 0,
    prSubmitted: 0,
    merged: 0,
    mergedThisMonth: 0,
    currentStreak: 0,
    bestStreak: 0,
  };

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const activityDays = new Set();

  for (const issue of savedIssues ?? []) {
    const status = normalizeIssueStatus(issue.status);
    stats.total += 1;

    const savedDay = toLocalDay(issue.saved_at);
    if (savedDay) {
      activityDays.add(savedDay);
    }

    if (status === "working") {
      stats.working += 1;
      const day = toLocalDay(issue.working_at);
      if (day) {
        activityDays.add(day);
      }
    } else if (status === "pr-submitted") {
      stats.prSubmitted += 1;
      const day = toLocalDay(issue.pr_submitted_at);
      if (day) {
        activityDays.add(day);
      }
    } else if (status === "merged") {
      stats.merged += 1;
      stats.prSubmitted += 1;
      const subDay = toLocalDay(issue.pr_submitted_at);
      if (subDay) {
        activityDays.add(subDay);
      }
      const mergedDay = toLocalDay(issue.merged_at);
      if (mergedDay) {
        activityDays.add(mergedDay);
        if (mergedDay.startsWith(monthKey)) {
          stats.mergedThisMonth += 1;
        }
      }
    }
  }

  const days = [...activityDays].sort();
  const daySet = new Set(days);

  // Current streak: count consecutive active days back from today. A day with
  // no activity yet today still keeps the streak alive (it ends yesterday).
  const cursor = new Date();
  if (!daySet.has(toLocalDay(cursor.toISOString()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let current = 0;
  while (daySet.has(toLocalDay(cursor.toISOString()))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  stats.currentStreak = current;

  // Best streak: longest run of consecutive days on record.
  let best = 0;
  let run = 0;
  let prevTime = null;
  for (const key of days) {
    const t = dayKeyToLocalMidnight(key);
    if (prevTime !== null && t - prevTime === DAY_MS) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prevTime = t;
  }
  stats.bestStreak = best;

  return stats;
}
