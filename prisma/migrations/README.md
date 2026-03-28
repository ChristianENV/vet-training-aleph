# Prisma Migrate — this repository

## Baseline (`20260326231521_init`)

Single **greenfield** PostgreSQL migration that creates the initial MVP schema (later superseded in part by `20260328120000_session_questions_ai_usage`):

- `SessionTemplate`, `TrainingSession`, `SessionResponse` (legacy shape), `SessionAnalysis`, plus auth/progress/audit tables. (Initial migration historically included `SessionTemplateQuestion`; see session questions migration above.)
- **`SessionTurn` / `TurnSpeaker` are not created** — the product uses ordered questions and responses only.

Apply with:

```bash
npx prisma migrate deploy
```

(or `npm run db:migrate` in dev when creating new migrations — see root `README.md`).

## Legacy cleanup (`20260327210000_drop_legacy_session_turn_if_present`)

If a database was created from an **older** schema that still has chat-turn tables, this migration removes them **when present** (`IF EXISTS`). On fresh databases created only from `20260326231521_init`, it is a **no-op**.

## Session questions + AI usage (`20260328120000_session_questions_ai_usage`)

Replaces **fixed template questions** (`SessionTemplateQuestion`) with **per-session** `SessionQuestion`, expands `SessionResponse` for audio/transcript/attempts, and adds **`AiUsageLog`** and **`TechnicalIncident`**.

- **Destructive:** drops `SessionResponse` and `SessionTemplateQuestion` (no data backfill). Re-seed templates after migrate; session data is not preserved.
- See **`docs/session-domain-model.md`** for the new model and API breaking notes.

## Do not

- Edit `migration.sql` inside an already-applied migration folder (checksum in `_prisma_migrations` will drift).
- Use `prisma db push` for environments that should share one migration history — prefer `migrate deploy`.

## Failed migration (P3009)

If `prisma migrate deploy` stops with **P3009** and a migration name (e.g. after a transient DB error or an older SQL version of a migration):

1. Fix the cause (pull the latest migration SQL from `main` if we hardened it).
2. Mark the failed migration as rolled back so Migrate can retry:

   ```bash
   npx prisma migrate resolve --rolled-back 20260327210000_drop_legacy_session_turn_if_present
   ```

3. Apply again:

   ```bash
   npm run db:deploy
   ```

Only use `--applied` if you manually ran the SQL yourself and the database already matches the migration.
