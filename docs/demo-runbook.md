# Demo runbook

Short guide for a **live walkthrough** of the Vet English Training (Aleph) MVP. For setup details, see the root [README](../README.md).

## Pre-demo checklist

- [ ] **Node 20+**, **PostgreSQL** running; `DATABASE_URL` points at the demo database.
- [ ] **Migrations applied**: `npx prisma migrate deploy` (or `npm run db:migrate` locally).
- [ ] **Seed run**: `npm run db:seed` (templates + demo users; optional developer account if `DEV_USER_*` set).
- [ ] **Secrets**: `AUTH_SECRET` set; restart dev server after env changes.
- [ ] **AI evaluation path** (if demoing evaluation): `OPENAI_API_KEY` set; restart `npm run dev`.
- [ ] **Browser**: use a **clean profile** or sign out first; confirm you can open `http://localhost:3000/login` (or your deployed URL).

## Environment (minimum)

| Variable | Demo need |
|----------|-------------|
| `DATABASE_URL` | Required |
| `AUTH_SECRET` | Required |
| `OPENAI_API_KEY` | Required only for the “Run AI evaluation” step |
| `DEV_USER_EMAIL` / `DEV_USER_PASSWORD` | Optional — seeds protected **DEVELOPER** |

## Recommended walkthrough (happy path)

Use a **learner** account for steps 1–8; use **staff** accounts only where noted.

1. **Login** — Open `/login`, sign in (see [Demo accounts](#demo-accounts-seed-password)).
2. **Dashboard** — Confirm “What to do next” points to sessions or a concrete next step.
3. **Sessions** — `/sessions`: pick a **template** → **Start new session** (creates a draft and opens detail).
4. **Start session** — On session detail, **Start session** (Draft → Active).
5. **Answer in order** — For each question, enter a **transcript** (primary path). Save; confirm later questions stay **locked** until prior steps are answered.
6. **Complete session** — When all required prompts have answers, **Complete session**.
7. **AI evaluation** — In **Session analysis (AI)**, **Run AI evaluation**. Wait for **Completed** (or read **Failed** + retry). *Requires `OPENAI_API_KEY`.*
8. **Analyses** — `/analyses`: open the row → detail; confirm scores/summary. Check **Progress snapshot** on the same page.
9. **Dashboard (learner)** — `/dashboard`: confirm recent session, latest analysis, readiness/progress align with step 8.
10. **Role tour (optional)** — Sign out and repeat login as **product owner**, **admin**, **super admin**, or **developer** (see below) to show directory vs platform metrics, users admin, or diagnostics.

## Demo accounts (seed password)

After `npm run db:seed`, non-developer demo users share **`DEFAULT_SEED_PASSWORD`** (currently `12345678` — see `prisma/seed.ts`). **Change passwords in any shared or production environment.**

| Role | Example email (seed) | Typical demo use |
|------|----------------------|-------------------|
| **USER** | `student1@vet-training.local` | Learner flow: sessions → complete → evaluate |
| **PRODUCT_OWNER** | `owner@vet-training.local` | Adoption dashboard, read-only directory, org-wide session list |
| **ADMIN** | `admin@vet-training.local` | Users directory, create/edit users, staff dashboard (`admin` variant) |
| **SUPER_ADMIN** | `superadmin@vet-training.local` | Same as admin plus elevated dashboard counts (all accounts) |
| **DEVELOPER** | from `DEV_USER_EMAIL` only | Protected account; full permissions; not in normal user list |

## Which role for which screen

| Screen | USER | PRODUCT_OWNER | ADMIN | SUPER_ADMIN | DEVELOPER |
|--------|:----:|:---------------:|:-----:|:-----------:|:---------:|
| Dashboard | Learner | Staff (adoption) | Staff (directory) | Staff (+ all-accounts metrics) | Staff (+ diagnostics) |
| Sessions — create/run own | Yes | Yes | Yes | Yes | Yes |
| Sessions — view others | — | Yes | Yes | Yes | Yes |
| Users | — | List/search | Full admin | Full admin | Full admin |
| Analyses / progress | Own scope | Broader | Broader | Broader | Broader |
| Run AI evaluation | Own sessions only | Own only | Own only | Own only | Own only |

## Caveats to mention during demo

- **Transcript-first**: answers are **typed or pasted** text. **`audioUrl`** is an optional link to **externally hosted** audio — there is **no in-app recording** yet.
- **Evaluation**: needs **`OPENAI_API_KEY`**; failures show as analysis **Failed** with a message (retry allowed). The API may return HTTP 200 with a failed model outcome — the UI explains **Succeeded** vs **Failed**.
- **Middleware** gates JWT presence, not every RBAC edge case — **server APIs enforce permissions**; trust the UI + API errors if something is denied.
- **Inactive accounts**: cannot sign in; deactivated users see errors on API, not always a bespoke screen on every route.

## After the demo

- Rotate shared demo passwords if the DB was exposed.
- For production: set `AUTH_URL` to the real origin, use strong secrets, and avoid committing `.env`.
