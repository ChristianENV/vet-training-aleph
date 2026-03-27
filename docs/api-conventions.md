# API conventions (BFF)

Route handlers under `src/app/api` act as the **backend-for-frontend** for the React app.

## General

- **Auth**: prefer `requirePermission`, `requireActiveUser`, `requireAuth`, or `requireAnyPermission` from `src/lib/auth/guards.ts` so responses stay consistent (`401` + `code: UNAUTHENTICATED`, `403` + `ACCOUNT_INACTIVE` or `FORBIDDEN`). For mutations on users, combine guards with `src/lib/auth/permissions.ts` (`canDeleteUser`, `canDeactivateUser`, `canAssignRole`, `canAdminUpdateUser`) so protected accounts (especially the seeded developer) cannot be changed by normal admin flows.
- **JSON shape**: prefer `{ ok: true, data }` / `{ ok: false, error, code?, details? }` via helpers in `src/lib/http/json.ts` (route handlers). Browser `fetch` wrappers parse the same envelope with `parseApiJsonResponse` in `src/lib/http/api-client.ts`.
- **Validation**: co-locate Zod schemas in `modules/*/validators` and parse `request.json()` in handlers before invoking application services.
- **Domain isolation**: handlers orchestrate; **Prisma** belongs in `modules/*/infrastructure` repositories, not in React components or ad hoc in handlers long term.

## Namespaces

| Path            | Purpose                                      |
| --------------- | -------------------------------------------- |
| `/api/auth/*`   | Auth.js — handled by `[...nextauth]` route   |
| `/api/users`    | Directory / admin user operations            |
| `/api/sessions` | Training session lifecycle                   |
| `/api/analyses` | Session analyses (future OpenAI integration) |

## Versioning

- No public third-party API is promised in this MVP. If external consumers appear, introduce `/api/v1` and explicit deprecation notes.
