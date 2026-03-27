# Roles and permissions

## `UserRole` (Prisma)

| Role | Purpose |
|------|---------|
| **USER** | Learner: guided sessions, own analyses, personal dashboard. |
| **PRODUCT_OWNER** | Program/product: read dashboards, user directory, sessions/analyses for oversight (read-heavy). |
| **ADMIN** | Operational admin: manage users, sessions, analyses; **cannot** override protected-system rules. |
| **SUPER_ADMIN** | Full customer-side control; can change other protected (non-developer) accounts; platform settings. |
| **DEVELOPER** | Internal technical account (seeded from env); same permission **set** as SUPER_ADMIN; **protected** row with fixed role. |

## Permission strings (`Permission`)

Defined in `src/lib/auth/permissions.ts`.

| Permission | Meaning |
|------------|---------|
| `users:list` | List users (apply `defaultUserListFilter()` to exclude protected accounts in normal listings). |
| `users:read` | View a user record. |
| `users:create` | Invite / create users. |
| `users:update` | Update profile fields (subject to protected-user helpers). |
| `users:deactivate` | Set `isActive` false. |
| `users:delete` | Hard delete user. |
| `users:assign_role` | Change `role`. |
| `sessions:use` | Create and run own training sessions. |
| `sessions:view_any` | Read sessions across users (support / product). |
| `analyses:view` | Read session analyses. |
| `analyses:request` | Trigger analysis jobs. |
| `dashboard:view` | Standard dashboards. |
| `dashboard:product` | Product-owner metrics and views. |
| `audit:view` | Read audit log. |
| `platform:settings` | Platform/system configuration. |

## Role × permission matrix (MVP)

| Permission | USER | PRODUCT_OWNER | ADMIN | SUPER_ADMIN | DEVELOPER |
|------------|:----:|:---------------:|:-----:|:-----------:|:---------:|
| `sessions:use` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `analyses:view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `analyses:request` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `dashboard:view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `dashboard:product` | | ✓ | | ✓ | ✓ |
| `users:list` | | ✓ | ✓ | ✓ | ✓ |
| `users:read` | | ✓ | ✓ | ✓ | ✓ |
| `users:create` | | | ✓ | ✓ | ✓ |
| `users:update` | | | ✓ | ✓ | ✓ |
| `users:deactivate` | | | ✓ | ✓ | ✓ |
| `users:delete` | | | ✓ | ✓ | ✓ |
| `users:assign_role` | | | ✓ | ✓ | ✓ |
| `sessions:view_any` | | ✓ | ✓ | ✓ | ✓ |
| `audit:view` | | ✓ | ✓ | ✓ | ✓ |
| `platform:settings` | | | | ✓ | ✓ |

**Note:** SUPER_ADMIN and DEVELOPER receive the full permission set in code. Operational difference: only the **DEVELOPER** row is seeded as **protected** with a **fixed role** (see below).

## Protected developer accounts (`isProtectedAccount`)

Seeded developer user:

- **Must** come from seed env vars (`DEV_USER_EMAIL`, `DEV_USER_PASSWORD`).
- **Must** have `isProtectedAccount = true` and `role = DEVELOPER`.
- **Must not** appear in standard user listings — filter with `defaultUserListFilter()` (`isProtectedAccount: false`) or equivalent in queries.

**Backend enforcement** (use helpers in `permissions.ts`; do not rely on UI alone):

| Action | Rule |
|--------|------|
| Delete | `canDeleteUser` → false if protected. |
| Deactivate (`isActive`) | `canDeactivateUser` → false if protected. |
| Reassign role | `canAssignRole` → false for seeded developer; for other protected users, only SUPER_ADMIN may change role. |
| Admin update | `canAdminUpdateUser` → ADMIN cannot edit the protected developer; SUPER_ADMIN (and DEVELOPER self) can. |

**TODO:** In user-service mutations, call these helpers and return **403** when the action is denied; log denials to `AuditLog` where appropriate.

## Middleware vs API

- **Middleware** (`middleware.ts`) only checks JWT presence; it does **not** enforce `isActive` or permissions.
- **Route handlers** should use **`src/lib/auth/guards.ts`** (`requirePermission`, `requireActiveUser`, `requireAnyPermission`, …) so **401** / **403** and `code` (`UNAUTHENTICATED`, `ACCOUNT_INACTIVE`, `FORBIDDEN`) stay consistent. For user mutations, combine with `canDeleteUser`, `canAssignRole`, etc.

## Server helpers

| Helper | Use when |
|--------|----------|
| `requireAuth()` | Session required; inactive users still pass (rare). |
| `requireActiveUser()` | Default for APIs; rejects inactive with **403** `ACCOUNT_INACTIVE`. |
| `requirePermission(p)` | Active user with a single permission. |
| `requireAnyPermission([…])` | Active user with at least one permission (e.g. sessions). |
| `requireAnyRole([…])` | Active user whose role is in the list. |
| `getAuthenticatedUserOrThrow()` / `requirePermissionOrThrow` | Server actions / services that prefer exceptions over `NextResponse`. |

Protected **DEVELOPER** visibility is enforced by **queries** (`defaultUserListFilter`) and **mutation helpers**, not by a separate guard—keep using `permissions.ts` for those checks.
