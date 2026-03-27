# Vet English Training (Aleph)

Production-oriented modular monolith: guided veterinary English training, Auth.js credentials, PostgreSQL + Prisma, TanStack Query, and domain code under `src/modules`.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local or hosted)

## Environment variables

Copy `.env.example` to `.env` and set:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string for Prisma |
| `AUTH_SECRET` | Yes | NextAuth secret (`openssl rand -base64 32`) |
| `AUTH_URL` | Optional | Canonical public URL for Auth.js. For local dev use `http://localhost:3000`. **In production, either omit it** (the app uses `trustHost` and same-origin redirects) **or set it to your real HTTPS origin** — never leave `localhost` in production or redirects can break. |
| `DEV_USER_EMAIL` / `DEV_USER_PASSWORD` | Optional | Seed a protected `DEVELOPER` account (see Seed) |
| `OPENAI_API_KEY` | For AI evaluation | Required to run session analysis / evaluation |
| `OPENAI_EVAL_MODEL` | Optional | Defaults to `gpt-4o-mini` in evaluation code if unset |

Never commit `.env` with real secrets.

## Setup

1. **Install:** `npm install` (runs `prisma generate` via `postinstall`).
2. **Configure:** copy `.env.example` → `.env` and fill `DATABASE_URL`, `AUTH_SECRET`, and optionally `AUTH_URL`.
3. **Schema:** `npm run db:migrate` (or `npm run db:push` for a quick local sync without migration files).
4. **Seed:** `npm run db:seed` — loads session templates; creates a developer user if `DEV_USER_EMAIL` and `DEV_USER_PASSWORD` are set in `.env`.
5. **Run:** `npm run dev` → [http://localhost:3000](http://localhost:3000). Sign in via `/login`; authenticated users are sent to `/dashboard`.

## Main flows

1. **Login** — Credentials provider; inactive accounts are blocked at guard level.
2. **Training sessions** — Pick a template → create a draft → **Start session** → save an answer per **question** (transcript/audio URL for now) → **Complete session** → then **Run AI evaluation** (owner) or view read-only (privileged roles with `sessions:view_any`).
3. **AI evaluation** — After **Complete session**, open the same session and use **Run AI evaluation** (requires `OPENAI_API_KEY` and permission `analyses:request`). Results appear on the session and under **Analyses**; progress snapshot updates when an evaluation completes.
4. **Analyses** — List and detail pages for `SessionAnalysis` rows; link back to the originating session.
5. **Users (admin)** — Directory search, create user, change role, activate/deactivate (RBAC + protected-account rules enforced server-side).
6. **Dashboard** — Role-based: learner next steps and snapshots; staff metrics from live DB counts.

## How to run AI evaluation

1. Set `OPENAI_API_KEY` in `.env` and restart `npm run dev`.
2. Complete a training session (status **Completed**).
3. On the **session detail** page, in **Session analysis (AI)**, click **Run AI evaluation** and wait until status shows **Completed** (or **Failed** with an error message you can retry).

If the key is missing or invalid, the API returns an error; the UI shows the message from the server.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run db:push` | Push Prisma schema (dev) |
| `npm run db:migrate` | Create/apply migrations |
| `npm run db:seed` | Run `prisma/seed.ts` |
| `npm run db:studio` | Prisma Studio |
| `npm run db:generate` | Regenerate Prisma client |

## Generated Prisma client

Output: `src/generated/prisma` (gitignored). Regenerate after schema changes: `npm run db:generate` or `npm install`.

## Architecture (short)

- **BFF** — `src/app/api/*` returns `{ ok, data }` / `{ ok, error, code? }` via `src/lib/http/json.ts`.
- **Browser clients** — `src/lib/http/api-client.ts` (`parseApiJsonResponse`) shared by module `*-api.ts` helpers.
- **Permissions** — `src/lib/auth/permissions.ts` + route guards; UI hides actions that would fail, servers still enforce.
- **Docs** — `docs/architecture.md`, `docs/api-conventions.md`, `docs/roles-and-permissions.md`.

## Post-MVP TODOs (non-blocking)

- Rate limiting and account lockout on login.
- Richer observability for OpenAI failures (retries, idempotency keys).
- Public API versioning if external consumers appear (`/api/v1`).
