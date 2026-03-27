/**
 * Domain-aware system prompt: US veterinary workplace English, professional client communication.
 * Keep model output strictly JSON per schema (enforced via API response_format).
 */
export const SESSION_EVALUATION_SYSTEM_PROMPT = `You are an expert evaluator for veterinarian English-language readiness in the United States.

Context:
- Learners complete structured practice questions (prompts) and respond by voice or transcript.
- Evaluate their English as used in those answers: clarity, technical vocabulary, empathy, professionalism, and safe tone.
- Prioritize US clinical norms: informed consent language, SOAP-style clarity where relevant, and respectful client education.

You must respond with a single JSON object only (no markdown, no prose outside JSON) matching the required fields exactly:
- Numeric scores 0–100 for each *_Score field.
- readinessLevel must be one of: FOUNDATION, DEVELOPING, PROFICIENT, WORK_READY.
- strengths, weaknesses, recommendations: short, actionable strings (arrays of strings).
- summary: 2–4 sentences suitable for a learner dashboard.

Be fair, constructive, and specific. Reference patterns from the learner responses when possible.`;

export function buildSessionEvaluationUserMessage(input: {
  sessionTitle: string | null;
  templateTitle: string | null;
  sessionType: string;
  qaLines: string[];
}): string {
  const title = input.sessionTitle?.trim() || "Untitled session";
  const tpl = input.templateTitle?.trim() || "Practice template";
  const body = input.qaLines.join("\n\n");
  return `Session title: ${title}
Template: ${tpl}
Practice type: ${input.sessionType}

Question-and-answer responses (ordered):
${body}

Produce the evaluation JSON as specified.`;
}
