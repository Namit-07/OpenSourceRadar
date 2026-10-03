# OpenSource Radar 📡

Find **real, available** open source issues to contribute to. No more "already taken" frustration.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC)

## Features

- 🔍 Browse issues labeled "good first issue", "beginner", "help wanted"
- 🐙 **GitHub sign-in required** — no anonymous browsing; every search runs on your own account (30 searches/min, your own quota)
- 🎯 Filter by programming language
- ✅ See which issues are available (no assignees)
- ⏱️ View issue freshness and activity
- 🔗 Direct links to GitHub

## Getting Started

```bash
# Install dependencies
npm install

# Configure GitHub OAuth (see below)
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

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
| UI (`src/app/page.js`) | Signed out → the catalog is replaced by `SignInGate`; no request is ever made |
| Server (`src/app/api/issues/route.js`) | No token in the session cookie → **`401` with `signInRequired: true`**, GitHub is never called |

So even a hand-crafted request to `/api/issues` with no session returns an error, never issues.

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

> Deploying? Register a second OAuth App for the production domain, point the
> callback at `https://your-domain.com/api/auth/callback/github`, and set `AUTH_URL`
> in your hosting provider's environment variables.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS
- **Auth**: Auth.js v5 (`next-auth@beta`) + GitHub OAuth
- **Data**: GitHub REST API (proxied server-side on the user's token)

## License

MIT
