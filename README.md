# OpenSource Radar 📡

Find **real, available** open source issues to contribute to — and save the ones you
want to work on. No more "already taken" frustration, no more losing that perfect
issue you were "going to get to."

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC)
![Auth.js](https://img.shields.io/badge/Auth.js-v5-purple)
![Database](https://img.shields.io/badge/DB-Turso-4FF8D2)

## Features

- 🔍 **Browse contribution-ready issues** labeled "good first issue", "beginner", "help wanted", etc.
- 🐙 **GitHub sign-in required** — no anonymous browsing; every search runs on your own account (30 searches/min, your own quota)
- 🎯 **Curated collections** — hand-picked, mentor-rich orgs (GSoC, foundations, data/AI, infra, web) instead of random repos
- 🔖 **Save issues** — bookmark the issues you want to work on and revisit them anytime at `/saved`
- ☁️ **Cross-device saves** — saved issues are stored in a database keyed to your GitHub account, so they follow you across devices
- 🌐 **Filter** by language, difficulty, freshness, and availability
- ✅ See which issues are still available (no assignees)
- ⏱️ View issue freshness and activity
- 📱 **Mobile-ready** — collapsible filters and a trimmed landing page so issues are front-and-center on phones
- 🔐 **Security-first APIs** — auth-gated routes, strict input validation, per-user rate limiting, and parameterized queries

## Getting Started

```bash
# Install dependencies
npm install

# Configure environment variables (see below)
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Local dev needs no database setup.** With `TURSO_DATABASE_URL` unset, the app
> automatically uses a local SQLite file at `data/radar.db` — so you can run and
> test the entire save flow without any cloud account. See [Database](#database--saved-issues).

## Sign up with GitHub

Sign-up uses [Auth.js v5](https://authjs.dev) (the `next-auth@beta` package) with the
GitHub OAuth provider. No database is required: the session lives in an encrypted,
`HttpOnly` cookie, and the GitHub access token is stored **inside that JWT only** —
it is never sent to the browser.

1. Open ⚠️ **[OAuth Apps](https://github.com/settings/applications/new)** — *not* the "GitHub Apps" page.
   Both live under Settings → Developer settings, and it's easy to pick the wrong one.
   This project expects an OAuth App: a Client ID + Client Secret and long-lived user tokens.
   (A GitHub App can also do sign-in, but its user tokens expire after ~8 hours and would
   need refresh handling that isn't implemented yet — use an OAuth App.)
2. Fill in:
   - **Application name**: `OpenSource Radar (local)`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
   - There is **no webhook URL on this form** — this app never receives webhook events.
     If a form is asking you for a Webhook URL, you are on the GitHub App page: go back to step 1.
   - Leave **Expire user access tokens** *unchecked* while the token refresh flow isn't
     implemented, otherwise the stored token dies after ~8 hours and the catalog will ask
     you to reconnect.
3. Copy the **Client ID**, generate a **Client Secret**, and put both in `.env.local`:

```bash
AUTH_SECRET="<random 32-byte base64 string>"
AUTH_GITHUB_ID="<client id>"
AUTH_GITHUB_SECRET="<client secret>"
AUTH_TRUST_HOST="true"
```

4. Restart `npm run dev`, open [http://localhost:3000](http://localhost:3000), and click
   **Sign up with GitHub**. The catalog stays locked until you do.

### Sign-in is mandatory

There is **no anonymous browsing**. Two independent layers enforce it:

| Layer | Behaviour |
| --- | --- |
| UI (`src/app/page.js`, `src/app/saved/page.js`) | Signed out → the catalog / saved list is replaced by `SignInGate`; no request is ever made |
| Server (`src/app/api/*/route.js`) | No token in the session cookie → **`401` with `signInRequired: true`**, GitHub and the database are never touched |

So even a hand-crafted request to `/api/issues` or `/api/saved-issues` with no session
returns an error, never data.

### How the token is used

`GET /api/issues` reads the caller's token from the encrypted session cookie
(`src/lib/session.js`) and forwards it to GitHub, so every search runs as that
contributor on their own quota:

| Caller | GitHub search quota | Behaviour |
| --- | --- | --- |
| No session cookie | — | `401 signInRequired` — nothing is fetched from GitHub |
| Signed in | 30 searches/min, per user | Header shows avatar/@handle; results panel shows the live remaining count |

> GitHub's **search** API has its own per-minute budget — separate from the 60/hour and
> 5,000/hour figures you see for the rest of the REST API — so signing in buys 30
> searches/min, attributed to the user rather than to the server's IP. The number shown
> in the UI is read live from GitHub's `x-ratelimit-*` response headers.

The requested scope is `read:user user:email` — read-only, so the token can never
write to anyone's repositories.

## 🔖 Save Issues

Save the issues you decide to work on and revisit them at **`/saved`**.

- **Save** from any issue card (the bookmark button in the top-right corner).
- The header shows a **Saved** link with a live count badge.
- Saves update **optimistically** (the UI flips instantly) and roll back automatically
  if the server request fails.
- Everything is **keyed to your GitHub account**, so it follows you across devices —
  not stuck in one browser.

## Database (Saved Issues)

Saved issues are stored server-side in a database keyed by your stable GitHub id
(`src/lib/db.js`). The connection **auto-selects** based on environment:

| Environment | Backing store |
| --- | --- |
| Local dev (no `TURSO_DATABASE_URL`) | Local SQLite file at `data/radar.db` — no account needed |
| Production (serverless like Vercel) | [Turso](https://turso.tech) — SQLite-compatible, free tier |

Turso speaks the same SQL as SQLite, so all queries are portable and only the
connection handle changes between environments.

### Setting up Turso (production)

```bash
# 1. Install the CLI and sign up
turso auth signup            # or: turso auth login

# 2. Create a database
turso db create opensource-radar

# 3. Create an auth token  -> TURSO_AUTH_TOKEN
turso db tokens create opensource-radar

# 4. Get the database URL   -> TURSO_DATABASE_URL
turso db show opensource-radar --url
```

Then set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in your host's environment
variables. The table and indexes are created automatically on first use.

## API Routes

All routes are **auth-gated** (401 without a session), **per-user scoped**, and
**rate-limited**. Queries are fully parameterized (no SQL injection).

| Method | Route | Purpose | Rate limit |
| --- | --- | --- | --- |
| `GET` | `/api/issues` | Proxy GitHub issue search on the user's token | (GitHub's own 30/min) |
| `GET` | `/api/saved-issues` | List the current user's saved issues | 60/min per user |
| `POST` | `/api/saved-issues` | Save (or re-save) an issue | 30/min per user |
| `DELETE` | `/api/saved-issues/[id]` | Remove a saved issue | shares the 30/min write budget |

**Input validation** (`src/lib/validateIssue.js`): every saved issue is validated
before storage — numeric id, a safe `https://github.com/...` link (blocks
`javascript:` / `data:` XSS vectors), a GitHub repository URL, and length caps.

> **Rate limiter note:** the limiter is in-memory, so it's a hard per-user cap on a
> single server, but per-instance on serverless. For a strict global limit, swap the
> internal map for a shared store (e.g. Upstash/Redis) without changing route code.

## Mobile & Responsive

The app is fully responsive and tuned for phones:

- Grids collapse to a single column; the landing page trims its decorative marketing
  sections so the issue catalog is front-and-center.
- The **filter panel is collapsible** on mobile (collapsed by default) so results
  aren't buried below the fold.
- Issue cards, pagination, and the save button all have comfortable tap targets.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + Tailwind CSS v4
- **Auth**: Auth.js v5 (`next-auth@beta`) + GitHub OAuth (JWT sessions)
- **Database**: Turso / libSQL (`@libsql/client`) for saved issues; local SQLite file in dev
- **Data**: GitHub REST API (proxied server-side on the user's token)

## Deployment

This app deploys cleanly to **Vercel** (or any Node host). Because a file-based DB
won't persist on serverless, use **Turso** in production (see above).

1. **Push** your code to GitHub and **import** the repo on [vercel.com](https://vercel.com).
2. Set these **Environment Variables** (Production):

   | Key | Value |
   | --- | --- |
   | `AUTH_SECRET` | a fresh random 32-byte base64 string |
   | `AUTH_GITHUB_ID` | from your **production** GitHub OAuth App |
   | `AUTH_GITHUB_SECRET` | from your **production** GitHub OAuth App |
   | `AUTH_TRUST_HOST` | `true` |
   | `TURSO_DATABASE_URL` | from `turso db show ... --url` |
   | `TURSO_AUTH_TOKEN` | from `turso db tokens create ...` |

   Generate a secret with:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
3. Register a **production** GitHub OAuth App with the callback URL
   `https://your-domain.com/api/auth/callback/github`.
4. **Deploy.** Vercel auto-detects Next.js — no extra config needed.

## Roadmap

Planned next:

- 🧭 **Contribution tracker** — add a status to each saved issue (`Saved → Working on it → PR submitted → Merged`) plus personal notes
- 🔎 **"Still available?" check** — live re-check of issue state so you don't start work on an already-claimed or closed issue
- 🔗 **Link your PR** — attach the PR you opened and build a contribution history/streak
- 🌙 **True dark mode**
- 🔔 Reminders for untouched saved issues

## License

MIT
