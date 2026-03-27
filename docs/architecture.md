# Architecture

This repository follows a **modular monolith**: one deployable Next.js application with **domain-oriented modules** under `src/modules/*`. Each module owns its own layered folders (`application`, `domain`, `infrastructure`, `presentation`, `validators` where applicable) so business rules stay testable and UI stays thin.

## Layers

- **App Router (`src/app`)** — routing, layouts, and **BFF-style route handlers** under `src/app/api/*`. Handlers validate input, call application services, and return JSON. They should not embed Prisma queries directly once repositories exist.
- **Modules (`src/modules`)** — business capabilities (auth, users, sessions, analyses, dashboards, openai). **Prisma access stays in `infrastructure`** repositories; **OpenAI SDK usage stays in `modules/openai/infrastructure`**.
- **Cross-cutting libs (`src/lib`)** — `config` (env validation), `db` (Prisma singleton with PostgreSQL adapter), `auth` (permissions map), `http` (JSON helpers), `utils`.
- **UI (`src/components`)** — shadcn/ui primitives in `components/ui`, shared chrome in `components/shared`.

## Data

- **PostgreSQL** with **Prisma ORM 7** and the **`pg` driver adapter** (`@prisma/adapter-pg`). The generated client outputs to `src/generated/prisma` (gitignored; recreated via `npm run db:generate` / `postinstall`).
- **Auth.js** uses **credentials + JWT sessions** for the MVP scaffold; Prisma is only loaded inside the credentials `authorize` callback (dynamic import). **Middleware** uses `getToken` from `next-auth/jwt` (cookie/JWT only) so the Edge bundle never imports Prisma or `pg`.

## Client data fetching

- **TanStack Query** is provided at the root for future hooks that call the BFF. Server Components should prefer `auth()` and direct service calls where appropriate.

## Identity

- **`UserRole`**: `USER`, `PRODUCT_OWNER`, `ADMIN`, `SUPER_ADMIN`, `DEVELOPER` (see `docs/roles-and-permissions.md`). The seeded developer account is `DEVELOPER` with `isProtectedAccount: true`.

## Conventions

- Prefer **explicit names** (`TrainingSession`, `SessionTemplate`, `isProtectedAccount`).
- **TODO comments** mark intentional gaps for the next implementation phase—avoid speculative abstractions.
