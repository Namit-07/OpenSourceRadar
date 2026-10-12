import path from "node:path";
import fs from "node:fs";
import { createClient } from "@libsql/client";

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
      saved_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

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
 * Insert a saved issue for a user. Idempotent: re-saving an existing issue
 * updates its snapshot in place instead of erroring.
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
  };

  await db.execute({
    sql: `INSERT INTO saved_issues
       (id, github_id, number, title, html_url, repository_url, comments,
        created_at, updated_at, labels, assignees, saved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
    ],
  });

  return { ...record, labels: JSON.parse(labels), assignees: JSON.parse(assignees) };
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