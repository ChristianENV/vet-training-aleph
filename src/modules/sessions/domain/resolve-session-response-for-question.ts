/**
 * Match a SessionResponse row to its SessionQuestion.
 * Prefer `sessionQuestionId === question.id`. If nothing matches (rare id drift), fall back to
 * the unique response with the same ordinal so transcripts stay visible in coaching UI and evaluation.
 */
export function resolveSessionResponseForQuestion<
  T extends { sessionQuestionId: string; ordinal: number },
>(question: { id: string; ordinal: number }, responses: T[]): T | undefined {
  const byId = new Map(responses.map((r) => [r.sessionQuestionId, r]));
  const direct = byId.get(question.id);
  if (direct) return direct;
  const sameOrdinal = responses.filter((r) => r.ordinal === question.ordinal);
  if (sameOrdinal.length === 1) return sameOrdinal[0];
  return undefined;
}
