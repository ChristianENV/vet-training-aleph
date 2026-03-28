# Vet English Training (Aleph)

Production-oriented modular monolith: guided veterinary English training, Auth.js credentials, PostgreSQL + Prisma, TanStack Query, and domain code under `src/modules`.

**Demo / walkthrough:** see [docs/demo-runbook.md](docs/demo-runbook.md) for a pre-demo checklist, recommended steps, and role × screen matrix.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local or hosted)

## Environment variables

Copy **`.env.example`** to **`.env`** (and optionally **`.env.local`** for machine-specific overrides). **`DATABASE_URL` must be set in `.env` or `.env.local`** — Prisma CLI and `npm run db:seed` load both files (same idea as Next.js).

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string for Prisma |
| `AUTH_SECRET` | Yes | NextAuth secret (`openssl rand -base64 32`) |
| `AUTH_URL` | Optional | Canonical public URL for Auth.js. For local dev use `http://localhost:3000`. **In production, either omit it** (the app uses `trustHost` and same-origin redirects) **or set it to your real HTTPS origin** — never leave `localhost` in production or redirects can break. Middleware reads the JWT cookie name that matches HTTPS (`__Secure-authjs.session-token`); see `middleware.ts`. |
| `DEV_USER_EMAIL` / `DEV_USER_PASSWORD` | Optional | Seed a **protected** `DEVELOPER` account (excluded from normal user listings). See [Seed](#seed) |
| `OPENAI_API_KEY` | **For AI evaluation** | Required to run session analysis / evaluation after a session is **Completed** |
| `OPENAI_EVAL_MODEL` | Optional | Defaults to `gpt-4o-mini` in evaluation code if unset |
| `APP_ENV` | Optional | e.g. `local` for a workstation. With unset `SESSION_GENERATION_*`, **`APP_ENV=local`** uses **4–4** questions (same as **`NODE_ENV=development`**). Otherwise defaults follow **`SESSION_GENERATION_*`** rules below. |
| `SESSION_GENERATION_MIN_QUESTIONS` / `SESSION_GENERATION_MAX_QUESTIONS` | Optional | Integer bounds (1–25) for how many oral prompts GPT generates per session. If unset: **`APP_ENV=local` or `NODE_ENV=development`** → **4–4**; **all other cases** (e.g. production, test CI) → **5–10**. Min must be ≤ max. |
| `R2_*` (see **`.env.example`**) | Optional for uploads | Cloudflare R2 credentials and bucket. Without all required pieces, final audio keeps **dev-placeholder** keys only (nothing uploaded). |
| `R2_PUBLIC_BASE_URL` or **`R2_PUBLIC_URL`** | Optional for playback | When set, analysis **Per-prompt coaching** can show an **`<audio>`** player for answers stored with provider **`r2`**, using `{publicBase}/{objectKey}`. The bucket (or custom domain) must allow **public read** and **CORS** from your site origin. |

Never commit `.env` with real secrets.

### Answers: transcript vs audio (MVP)

- **Demo path:** use **`transcriptText`** — type or paste spoken-style answers in the session UI.
- **`audioUrl`** is **optional metadata** (e.g. link to a file hosted elsewhere). **In-app microphone recording is not implemented**; do not demo it as a productized feature.

## Setup

1. **Install:** `npm install` (runs `prisma generate` via `postinstall`).
2. **Configure:** copy `.env.example` → `.env` and fill `DATABASE_URL`, `AUTH_SECRET`, and optionally `AUTH_URL` and `OPENAI_API_KEY` (for evaluation).
3. **Schema (migrations):** apply migrations so the DB matches `prisma/schema.prisma`:
   - **CI / staging / production:** `npx prisma migrate deploy` (uses committed SQL under `prisma/migrations/`).
   - **Local dev:** `npm run db:migrate` (wraps `prisma migrate dev` — creates new migration files when you change the schema).
   - **Throwaway DB only:** `npm run db:push` skips migration history — use only when you do not need reproducible deploys.
4. **Seed:** `npm run db:seed` — loads session templates and **demo users** (learners, product owner, admin, super admin); optionally a protected developer if `DEV_USER_EMAIL` and `DEV_USER_PASSWORD` are set. See [Seed](#seed).
5. **Run:** `npm run dev` → [http://localhost:3000](http://localhost:3000). Sign in via `/login`; authenticated users are sent to `/dashboard`.

## Seed

- **Templates:** published session templates and ordered questions (idempotent upserts).
- **Demo users:** shared password from `DEFAULT_SEED_PASSWORD` in `prisma/seed.ts` (documented in console output — **change in any shared environment**). Includes roles: **USER**, **PRODUCT_OWNER**, **ADMIN**, **SUPER_ADMIN**.
- **Developer:** if `DEV_USER_EMAIL` / `DEV_USER_PASSWORD` are set, upserts a **protected** `DEVELOPER` account (`isProtectedAccount: true`, fixed role) — **not** shown in standard directory listings.

Role preparation for demos is covered in [docs/demo-runbook.md](docs/demo-runbook.md).

## Main flows

1. **Login** — Credentials provider; inactive accounts cannot authenticate (`src/auth.ts`).
2. **Training sessions** — Pick a template → create a draft → **Start session** → save an answer per **question** (transcript recommended; optional external **audio URL**) → **Complete session** → **Run AI evaluation** (session owner; requires `OPENAI_API_KEY`) or view read-only (privileged roles with `sessions:view_any`).
3. **AI evaluation** — After **Complete session**, on the session detail page, **Session analysis (AI)** → **Run AI evaluation** (permission `analyses:request`). Results appear on the session and under **Analyses**; progress snapshot updates when an evaluation **completes successfully**. The API may return HTTP 200 with a failed model outcome — the UI distinguishes **Succeeded** vs **Failed** (see `src/app/api/sessions/[sessionId]/analysis/evaluate/route.ts` and `SessionAnalysisPanel`).
4. **Analyses** — List and detail pages for `SessionAnalysis` rows; link back to the originating session.
5. **Users (admin)** — Directory search, create user, change role, activate/deactivate (`src/app/(protected)/users/page.tsx`; RBAC + protected-account rules enforced server-side).
6. **Dashboard** — Role-based: learner next steps and snapshots (`UserDashboardView`); staff metrics with explicit **directory** vs **platform-wide** scope (`StaffDashboardView`, `src/modules/dashboards/application/dashboard-data-service.ts`).

## How to run AI evaluation

1. Set `OPENAI_API_KEY` in `.env` and restart `npm run dev`.
2. Complete a training session (status **Completed**) with at least one saved answer (transcript and/or optional audio URL).
3. On the **session detail** page, in **Session analysis (AI)**, click **Run AI evaluation** and wait until the status shows **Completed** or **Failed** (failed runs can be retried).

If the key is missing, the API returns **503** with a clear message; if invalid, you will see an error from the server in the UI.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run db:push` | Push schema without migration files (throwaway local DBs only) |
| `npm run db:migrate` | `prisma migrate dev` — apply/create migrations locally |
| `npx prisma migrate deploy` | Apply committed migrations (CI/production) |
| `npm run db:deploy` | Same as `prisma migrate deploy` |
| `npm run db:seed` | Run `prisma/seed.ts` |
| `npm run db:studio` | Prisma Studio |
| `npm run db:generate` | Regenerate Prisma client |

## Generated Prisma client

Output: `src/generated/prisma` (gitignored). Regenerate after schema changes: `npm run db:generate` or `npm install`.

## Architecture (short)

- **BFF** — `src/app/api/*` returns `{ ok, data }` / `{ ok, error, code? }` via `src/lib/http/json.ts`.
- **Browser clients** — `src/lib/http/api-client.ts` (`parseApiJsonResponse`) shared by module `*-api.ts` helpers.
- **Permissions** — `src/lib/auth/permissions.ts` + route guards; UI hides actions that would fail, servers still enforce.
- **Docs** — `docs/architecture.md`, `docs/api-conventions.md`, `docs/roles-and-permissions.md`, `docs/session-domain-model.md` (session questions, responses, AI usage / incidents).

## Post-MVP TODOs (non-blocking)

- Rate limiting and account lockout on login.
- In-app audio capture for answers (today: transcript + optional external audio URL).
- Richer observability for OpenAI failures (retries, idempotency keys).
- Public API versioning if external consumers appear (`/api/v1`).
