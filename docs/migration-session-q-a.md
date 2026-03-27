# Migration: session turns → question/response model

## Summary

The product flow is **guided evaluation**, not chat:

- `SessionTemplate` + **`SessionTemplateQuestion`** (ordered prompts)
- `TrainingSession` (learner attempt)
- **`SessionResponse`** (one row per question: transcript and/or audio URL metadata)
- `SessionAnalysis` (unchanged; evaluation reads Q&A, not dialogue turns)

Removed: **`SessionTurn`**, **`TurnSpeaker`** enum.

`TrainingSession.inputMode` defaults to **`VOICE`** (learners still submit **transcript text** in the MVP UI until capture is wired).

## Schema changes (Prisma)

| Change | Notes |
|--------|--------|
| `SessionTemplateQuestion` | `templateId`, `ordinal`, `promptText`, `helpText`, `expectedDurationSec`, `isRequired` |
| `SessionResponse` | `sessionId`, `templateQuestionId`, `ordinal`, `audioUrl`, `transcriptText`, `durationSec`, `answeredAt` |
| Drop `SessionTurn` | All prior turn rows are **lost** on migrate |
| Drop `TurnSpeaker` | Enum removed with `SessionTurn` |

## Apply locally

1. **Backup** production DB if applicable.
2. From repo root, with `DATABASE_URL` set:

   ```bash
   npx prisma migrate dev --name session_questions_responses
   ```

   For a throwaway dev DB you may use:

   ```bash
   npx prisma db push
   ```

3. **Reseed** templates + questions:

   ```bash
   npm run db:seed
   ```

## API changes

| Removed | Added |
|---------|--------|
| `POST /api/sessions/[sessionId]/turns` | `POST /api/sessions/[sessionId]/responses` |

Session **GET/POST** responses include **`progress`**: `totalQuestions`, `answeredCount`, `currentQuestionId`, `completionPercent`.

`GET /api/sessions/templates` includes **`questions`** (ordered) and **`_count.questions`**.

## Manual follow-ups (if needed)

- Any external scripts that referenced `SessionTurn` or `TurnSpeaker` must be updated.
- Historical sessions in DB will have **no** `SessionResponse` rows until learners re-run flows after deploy.

## TODOs (post-MVP)

- Browser/device audio capture + upload pipeline feeding **`audioUrl`**.
- Stricter validation (file size, MIME types) when uploads exist.
- Optional: soft-delete or archive old `SessionTurn` data before drop (not implemented; schema prefers correctness over preserving chat rows).
