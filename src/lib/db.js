import path from "node:path";
import fs from "node:fs";
import { createClient } from "@libsql/client";
import { DEFAULT_ISSUE_STATUS } from "@/utils/constants";

/**
 * Tracker status -> the column that records when the pipeline first reached
 * that step. Used by updateSavedIssue so each advance stamps its own day,
 * which is what the contribution stats + streak are built from.
 */
const STATUS_STEP_COLUMNS = {
  working: "working_at",
  "pr-submitted": "pr_submitted_at",
  merged: "merged_at",
};

/**
 * Server-side persistence for saved issues.
 *
 * Connection strategy (auto-selected by environment):
 *   - Any env with TURSO_DATABASE_URL set (production) → the hosted Turso
 *     database. Turso is SQLite-compatible and works on serverless like Vercel.
 *   - Local dev without Turso → a local file at data/radar.db, so you can run
 *     and test the whole flow without any cloud account.
 *
 * Turso/libSQL speaks the same SQL as SQLite, so all queries below are
 * portable. The client is async, so every helper here returns a promise.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const LOCAL_DB_URL = `file:${path.join(DATA_DIR, "radar.db")}`;

// Reuse one client across hot-reloads in dev so we don't open new handles on
// every edit.
const globalForDb = globalThis;

function getClient() {
  if (globalForDb.__radarDb) {
    return globalForDb.__radarDb;
  }

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  let client;

  if (tursoUrl) {
    client = createClient({ url: tursoUrl, authToken: tursoToken });
  } else {
    // Local file mode: make sure the directory exists before SQLite opens it.
    fs.mkdirSync(DATA_DIR, { recursive: true });
    client = createClient({ url: LOCAL_DB_URL });
  }

  globalForDb.__radarDb = client;
  return client;
}

let schemaReady = false;

/** Create the table + indexes once per process. Idempotent. */
async function ensureSchema() {
  if (schemaReady) {
    return;
  }

  const db = getClient();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS saved_issues (
      -- Surrogate primary key. The GitHub issue id (column "id") is NOT the
      -- primary key on purpose: SQLite treats an "INTEGER PRIMARY KEY" column
      -- as the rowid alias and refuses to use it inside a composite
      -- ON CONFLICT (github_id, id) upsert target. Keeping "id" a plain column
      -- lets us upsert per (user, issue) cleanly.
      pk            INTEGER PRIMARY KEY AUTOINCREMENT,
      id            INTEGER NOT NULL,
      github_id     TEXT    NOT NULL,
      number        INTEGER,
      title         TEXT    NOT NULL,
      html_url      TEXT    NOT NULL,
      repository_url TEXT,
      comments      INTEGER DEFAULT 0,
      created_at    TEXT,
      updated_at    TEXT,
      labels        TEXT    NOT NULL DEFAULT '[]',
      assignees     TEXT    NOT NULL DEFAULT '[]',
      saved_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      -- Contribution tracker: which pipeline step the issue is at, plus the
      -- contributor's personal notes ("why I picked this / my approach").
      status        TEXT    NOT NULL DEFAULT 'saved',
      notes         TEXT    NOT NULL DEFAULT '',
      pr_url        TEXT    NOT NULL DEFAULT '',
      -- When the pipeline first reached each step (NULL until then). Drives
      -- the contribution stats + activity streak on the saved page: every day
      -- a step is advanced counts as an active day.
      working_at    TEXT,
      pr_submitted_at TEXT,
      merged_at     TEXT
    );
  `);

  // Migrate databases created before the tracker columns existed. New
  // databases get the columns from CREATE TABLE above; this loop upgrades
  // legacy rows in place without touching their data. Add future columns
  // here the same way (ALTER TABLE has no IF NOT EXISTS in SQLite).
  for (const column of [
    { name: "status", definition: "TEXT NOT NULL DEFAULT 'saved'" },
    { name: "notes", definition: "TEXT NOT NULL DEFAULT ''" },
    { name: "pr_url", definition: "TEXT NOT NULL DEFAULT ''" },
    { name: "working_at", definition: "TEXT" },
    { name: "pr_submitted_at", definition: "TEXT" },
    { name: "merged_at", definition: "TEXT" },
  ]) {
    const tableInfo = await db.execute("PRAGMA table_info(saved_issues)");
    const hasColumn = tableInfo.rows.some((row) => row.name === column.name);
    if (!hasColumn) {
      await db.execute(
        `ALTER TABLE saved_issues ADD COLUMN ${column.name} ${column.definition}`
      );
    }
  }

  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_issues_user_issue
      ON saved_issues (github_id, id);
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_saved_issues_user
      ON saved_issues (github_id, saved_at DESC);
  `);

  schemaReady = true;
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Map a DB row back to the minimal shape IssueCard expects. */
function rowToIssue(row) {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    html_url: row.html_url,
    repository_url: row.repository_url,
    comments: row.comments,
    created_at: row.created_at,
    updated_at: row.updated_at,
    labels: safeParse(row.labels, []),
    assignees: safeParse(row.assignees, []),
    status: typeof row.status === "string" ? row.status : DEFAULT_ISSUE_STATUS,
    notes: typeof row.notes === "string" ? row.notes : "",
    pr_url: typeof row.pr_url === "string" ? row.pr_url : "",
    working_at: typeof row.working_at === "string" ? row.working_at : null,
    pr_submitted_at:
      typeof row.pr_submitted_at === "string" ? row.pr_submitted_at : null,
    merged_at: typeof row.merged_at === "string" ? row.merged_at : null,
  };
}

/**
 * List a user's saved issues, most recently saved first.
 * @param {string} githubId - Stable GitHub user id.
 * @returns {Promise<object[]>}
 */
export async function listSavedIssues(githubId) {
  await ensureSchema();
  const db = getClient();
  const result = await db.execute({
    sql: "SELECT * FROM saved_issues WHERE github_id = ? ORDER BY saved_at DESC, id DESC",
    args: [githubId],
  });
  return result.rows.map(rowToIssue);
}

/**
 * Saved issues eligible for PR auto-detection: those still in the pipeline
 * (saved / working) that carry enough repo context (repository_url + number)
 * to look up on GitHub. Sorted most-recently-saved first and capped so one
 * sync can never fan out into an unbounded number of upstream API calls.
 *
 * @param {string} githubId - Stable GitHub user id.
 * @param {number} limit - Maximum number of issues to return.
 * @returns {Promise<object[]>}
 */
export async function listSyncableSavedIssues(githubId, limit = 10) {
  await ensureSchema();
  const db = getClient();
  const result = await db.execute({
    sql: `SELECT * FROM saved_issues
          WHERE github_id = ?
            AND status IN ('saved', 'working')
            AND repository_url != ''
            AND number IS NOT NULL
          ORDER BY saved_at DESC, id DESC
          LIMIT ?`,
    args: [githubId, limit],
  });
  return result.rows.map(rowToIssue);
}


/**
 * Insert a saved issue for a user. Idempotent: re-saving an existing issue
 * updates its snapshot in place instead of erroring.
 *
 * IMPORTANT: the upsert deliberately does NOT touch `status`/`notes`. A
 * re-save is a snapshot refresh from GitHub-shaped data, and must never wipe
 * the contributor's tracker progress.
 *
 * @returns {Promise<object>} The normalized issue record.
 */
export async function saveIssue(githubId, issue) {
  await ensureSchema();
  const db = getClient();

  const labels = JSON.stringify(
    (issue.labels ?? []).map((l) => ({
      id: l.id ?? l.name,
      name: l.name ?? "",
      color: l.color ?? null,
    }))
  );
  const assignees = JSON.stringify(
    (issue.assignees ?? []).map((a) => ({ login: a.login }))
  );

  const record = {
    id: issue.id,
    number: issue.number ?? null,
    title: issue.title ?? "",
    html_url: issue.html_url ?? "",
    repository_url: issue.repository_url ?? "",
    comments: issue.comments ?? 0,
    created_at: issue.created_at ?? null,
    updated_at: issue.updated_at ?? null,
    // Freshly saved issues always start at the first pipeline step with empty
    // notes. Re-saves preserve existing values via the upsert below, which
    // excludes these columns on purpose.
    status: issue.status ?? DEFAULT_ISSUE_STATUS,
    notes: issue.notes ?? "",
    pr_url: issue.pr_url ?? "",
  };

  await db.execute({
    sql: `INSERT INTO saved_issues
       (id, github_id, number, title, html_url, repository_url, comments,
        created_at, updated_at, labels, assignees, saved_at, status, notes, pr_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)
     ON CONFLICT (github_id, id) DO UPDATE SET
       number = excluded.number,
       title = excluded.title,
       html_url = excluded.html_url,
       repository_url = excluded.repository_url,
       comments = excluded.comments,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at,
       labels = excluded.labels,
       assignees = excluded.assignees,
       saved_at = datetime('now')`,
    args: [
      record.id,
      githubId,
      record.number,
      record.title,
      record.html_url,
      record.repository_url,
      record.comments,
      record.created_at,
      record.updated_at,
      labels,
      assignees,
      record.status,
      record.notes,
      record.pr_url,
    ],
  });

  return { ...record, labels: JSON.parse(labels), assignees: JSON.parse(assignees) };
}

/**
 * Update one saved issue's tracker fields (`status` and/or `notes`) for a
 * user. Only the keys present in `updates` are written; anything else is
 * left untouched.
 *
 * @param {string} githubId - Stable GitHub user id.
 * @param {number|string} issueId - The GitHub issue id.
 * @param {{ status?: string, notes?: string, pr_url?: string }} updates - Validated fields.
 * @returns {Promise<object|null>} The updated issue record, or null when no
 *   such saved issue exists for this user.
 */
export async function updateSavedIssue(githubId, issueId, updates) {
  await ensureSchema();
  const db = getClient();

  const assignments = [];
  const args = [];

  if (updates.status !== undefined) {
    assignments.push("status = ?");
    args.push(updates.status);

    // Stamp the day this step was first reached (COALESCE keeps the original
    // date — re-clicking a step, or advancing past it, never rewrites it).
    // These timestamps power the contribution stats + streak.
    const stepColumn = STATUS_STEP_COLUMNS[updates.status];
    if (stepColumn) {
      assignments.push(`${stepColumn} = COALESCE(${stepColumn}, datetime('now'))`);
    }
    // A merged issue was necessarily submitted first.
    if (updates.status === "merged") {
      assignments.push(
        "pr_submitted_at = COALESCE(pr_submitted_at, datetime('now'))"
      );
    }
  }

  if (updates.notes !== undefined) {
    assignments.push("notes = ?");
    args.push(updates.notes);
  }

  if (updates.pr_url !== undefined) {
    assignments.push("pr_url = ?");
    args.push(updates.pr_url);
  }

  if (assignments.length === 0) {
    return null;
  }

  await db.execute({
    sql: `UPDATE saved_issues SET ${assignments.join(", ")} WHERE github_id = ? AND id = ?`,
    args: [...args, githubId, Number(issueId)],
  });

  const result = await db.execute({
    sql: "SELECT * FROM saved_issues WHERE github_id = ? AND id = ?",
    args: [githubId, Number(issueId)],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToIssue(result.rows[0]);
}

/**
 * Remove one saved issue for a user.
 * @returns {Promise<boolean>} Whether a row was deleted.
 */
export async function removeSavedIssue(githubId, issueId) {
  await ensureSchema();
  const db = getClient();
  const result = await db.execute({
    sql: "DELETE FROM saved_issues WHERE github_id = ? AND id = ?",
    args: [githubId, Number(issueId)],
  });
  return result.rowsAffected > 0;
}

/** Remove every saved issue for a user (used on account/data reset). */
export async function clearSavedIssues(githubId) {
  await ensureSchema();
  const db = getClient();
  await db.execute({
    sql: "DELETE FROM saved_issues WHERE github_id = ?",
    args: [githubId],
  });
}
