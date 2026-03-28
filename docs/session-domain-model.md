# Session domain persistence (v2)

## Overview

- **`SessionTemplate`**: Catalog topic / framework (slug, title, `sessionType`, `configJson`). **No fixed question rows** — prompts are created per session.
- **`TrainingSession`**: Learner run linked to a template (`templateId` optional after future changes). Status flow: `DRAFT` → `ACTIVE` → `COMPLETED` / `CANCELLED`.
- **`SessionQuestion`**: One row per generated prompt for **that** session (`ordinal`, `promptText`, optional timing hints, `generatedByModel`, `sourceTopic`). **Unique** `(sessionId, ordinal)`.
- **`SessionResponse`**: One row per **session question** (`sessionQuestionId`). Holds **attempt** metadata (`attemptCount`, `maxAttempts`), **final audio** metadata (`finalAudioStorageKey`, `finalAudioDurationSec`, …), optional **transcript** (`transcriptText`, `transcriptStatus`, `transcriptProvider`). **Unique** `(sessionId, sessionQuestionId)`.
- **`SessionAnalysis`**: Unchanged role — final evaluation payload for the session.
- **`AiUsageLog`**: One row per provider call (question generation, evaluation, future transcription). Links optionally to `userId`, `sessionId`, `analysisId`. Stores tokens, cost estimate, `status`, JSON metadata.
- **`TechnicalIncident`**: Operational errors (e.g. final audio save failure) with `stage`, `severity`, `detailsJson`.

## Runtime flow (target)

1. Create session from template (draft).
2. **Start session** → status `ACTIVE` → **generate questions** (GPT) → insert `SessionQuestion` rows; log `AiUsageLog` (`GENERATE_QUESTIONS`).
3. Learner answers with **audio** (attempts ≤ `maxAttempts`); transcript may be secondary.
4. **Complete session** → optional **automatic evaluation** (application) → `SessionAnalysis` + `AiUsageLog` (`EVALUATE_SESSION`).
5. Failures during final audio commit → `TechnicalIncident` (+ optional incident log line).

**Current code:** stub inserts one `SessionQuestion` at start (`session-question-stub.ts`) until GPT wiring exists.

## API breaking changes

- `POST .../responses` body: `templateQuestionId` → **`sessionQuestionId`**; `audioUrl` / `durationSec` removed in favor of **`finalAudioStorageKey`** and **`finalAudioDurationSec`** (optional `transcriptText` remains for dev/STT).

## Migrations

- **`20260328120000_session_questions_ai_usage`**: Drops legacy `SessionResponse` and `SessionTemplateQuestion`, adds `SessionQuestion`, new `SessionResponse` shape, `AiUsageLog`, `TechnicalIncident`. **Destructive** — existing session answers in the DB are lost.
