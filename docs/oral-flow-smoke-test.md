# Oral session flow — smoke test checklist

Use this for demo readiness and regression checks. Adjust steps if your environment omits R2 or OpenAI.

## Preconditions

- App running with database migrated and seed (or known test user).
- `OPENAI_API_KEY` set for full flow; optional R2 vars for real uploads (`R2_*` in env).

## Happy path

1. **Create session** from a published template → session is **Draft**.
2. **Begin oral assessment** → status **Generating questions** → then **In progress** with 5–10 prompts.
3. For **question 1…N** (in order): record → **replay** → **Save** (metadata persisted; no cloud upload yet).
4. Use **multiple attempts** on at least one prompt until max or stop before max; confirm **last-attempt** warning if applicable.
5. **Finish assessment** → banner “Saving…” → expect **Saving your responses** / **Analyzing** briefly, then redirect to **`/analyses/[id]`**.
6. Confirm **results**: summary, scores, readiness, strengths/weaknesses/recommendations.
7. **`AiUsageLog`**: one **GENERATE_QUESTIONS** (success) and one **EVALUATE_SESSION** (success) for the session, with tokens where the API returned usage and **estimatedCostUsd** only when both prompt and completion tokens exist.

## Transcript fallback (optional / forced)

1. Complete answers with **long enough written support** on a prompt where upload can be skipped or failed (e.g. dev without R2 may still persist placeholder; for true fallback, simulate upload failure + sufficient transcript per product rules).
2. Finish assessment → session **`finalizationMetaJson`** includes **`transcriptFallbackOrdinals`** for affected ordinals.
3. Analysis page shows the **amber “Written notes used for some prompts”** card; scoring still completes.

## Scoring unavailable (OpenAI)

1. With **`OPENAI_API_KEY` unset** (or invalid for your test), run **Finish** after answers are saved.
2. Expect **503**-style user message: answers **saved**, session **Completed**, no stuck **Analyzing**.
3. On session page, **Run evaluation again** (if permitted) when the key is restored — or confirm manual retry path copy is clear.

## Recoverable finalize (422)

1. Provoke **FINALIZE_RECOVERABLE** (e.g. insufficient written support when voice could not be saved — per server rules).
2. Session returns to **In progress**; user sees **recoverable** message and can retry **Finish** after fixing.

## RBAC / ownership (spot check)

- Session **owner** can start, answer, finish, and view own analysis (with **`analyses:view`** / **`analyses:request`** as applicable).
- **Non-owner** with **`sessions:view_any`** sees read-only session; cannot mutate.

## Dashboards

- Session list / dashboard shows new statuses (**Saving your responses**, **Analyzing**) with readable labels.

## Caveats

- **Cost** is estimated only for **gpt-4o-mini**-style models; other models log **null** `estimatedCostUsd`.
- **Repeated Finish** on a **Completed** session should fail with a clear validation error (not a second upload).
- Long finalize requests may time out on slow networks; keep demo recordings short if needed.
