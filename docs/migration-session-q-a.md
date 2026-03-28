# Migration: session turns → question/response model

## Summary

The product flow is **guided evaluation**, not chat:

- `SessionTemplate` + **`SessionTemplateQuestion`** (ordered prompts)
- `TrainingSession` (learner attempt)
- **`SessionResponse`** (one row per question: transcript and/or audio URL metadata)
- `SessionAnalysis` (unchanged; evaluation reads Q&A, not dialogue turns)

Removed from the domain: **`SessionTurn`**, **`TurnSpeaker`** enum.

`TrainingSession.inputMode` defaults to **`VOICE`** (learners still submit **transcript text** in the MVP UI until capture is wired).

## Committed migrations (this repo)

| Folder | Purpose |
|--------|---------|
| `prisma/migrations/20260326231521_init` | **Baseline** PostgreSQL schema: all current tables including `SessionTemplateQuestion` and `SessionResponse`. |
| `prisma/migrations/20260327210000_drop_legacy_session_turn_if_present` | **Optional cleanup**: drops legacy `SessionTurn` / `TurnSpeaker` **if they still exist** (e.g. DB upgraded from an older branch). No-op on fresh installs. |

See also `prisma/migrations/README.md`.

## Apply safely

### New database (recommended for local / new environments)

1. Set `DATABASE_URL` (see root `.env.example` pattern).
2. Apply migrations:

   ```bash
   npx prisma migrate deploy
   ```

   This runs every migration in `prisma/migrations` in order.

3. Seed templates and optional dev user:

   ```bash
   npm run db:seed
   ```

### Local development (creates new migration files when schema changes)

```bash
npm run db:migrate
```

(`prisma migrate dev` — uses your dev DB and updates migration history.)

### CI / staging / production

Use **`migrate deploy` only** — never `db push` — so all environments share the same migration history.

```bash
npx prisma migrate deploy
```

## When `db push` is acceptable

`npm run db:push` (`prisma db push`) is only appropriate for **throwaway local databases** where you do not need reproducible migration history. **Teams and production should use Migrate.**

## Destructive / data-loss caveats

| Scenario | Risk |
|----------|------|
| **Fresh `migrate deploy`** | None — creates empty tables. |
| **Legacy DB with `SessionTurn` rows** | Migration `20260327210000_*` **drops** the `SessionTurn` table and `TurnSpeaker` type. **All turn rows are permanently removed.** Export first if you need them. |
| **Databases that never had `SessionTurn`** | The drop migration is a no-op. |
| **Re-running migrations** | Prisma records applied migrations; they are not re-applied. |

## API changes (reference)

| Removed | Added |
|---------|-------|
| `POST /api/sessions/[sessionId]/turns` | `POST /api/sessions/[sessionId]/responses` |

Session **GET/POST** responses include **`progress`**: `totalQuestions`, `answeredCount`, `currentQuestionId`, `completionPercent`.

`GET /api/sessions/templates` includes **`questions`** (ordered) and **`_count.questions`**.

## Manual follow-ups (if needed)

- Any external scripts that referenced `SessionTurn` or `TurnSpeaker` must be updated.
- Historical sessions in DB will have **no** `SessionResponse` rows until learners re-run flows after deploy.
- If your old schema used **different table names** than `SessionTurn` / `TurnSpeaker`, adjust manually before or after migrate — do not edit applied migration files; add a **new** migration with a descriptive name.

## TODOs (post-MVP)

- Browser/device audio capture + upload pipeline feeding **`audioUrl`**.
- Stricter validation (file size, MIME types) when uploads exist.
