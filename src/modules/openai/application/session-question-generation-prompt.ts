import type { SessionType } from "@/generated/prisma/enums";

export const SESSION_QUESTION_GENERATION_SYSTEM = `You are an expert in veterinary workplace English for US clinical practice.
You write clear, professional, realistic oral-practice prompts for veterinary staff (English as a second language).
Rules:
- Prompts must be suitable for spoken answers (not chat threads).
- Use US veterinary context (clinic, client communication, consent, SOAP-style thinking where relevant).
- Each prompt must be distinct; avoid repeating the same scenario or wording.
- Cover different angles of the topic across the set (e.g. intake, consent, bad news, handoff, documentation).
- Ordinals must be sequential starting at 1.
- Return ONLY valid JSON matching the schema described in the user message (no markdown fences).`;

export function buildSessionQuestionGenerationUserMessage(input: {
  templateTitle: string;
  templateSlug: string;
  sessionType: SessionType;
  templateDescription: string | null;
  questionCountMin: number;
  questionCountMax: number;
  priorPromptsSample: string[];
}): string {
  const priorBlock =
    input.priorPromptsSample.length > 0
      ? [
          "Previously used prompts from this learner on the same topic (avoid duplicating or paraphrasing these closely):",
          ...input.priorPromptsSample.map((p, i) => `${i + 1}. ${p}`),
        ].join("\n")
      : "No prior prompts from this learner on this topic — you have full freedom within the topic.";

  return [
    `Topic template: "${input.templateTitle}" (slug: ${input.templateSlug})`,
    `Session type: ${input.sessionType}`,
    input.templateDescription ? `Description: ${input.templateDescription}` : "",
    "",
    priorBlock,
    "",
    `Generate between ${input.questionCountMin} and ${input.questionCountMax} questions inclusive.`,
    "",
    "Output JSON shape:",
    `{"questions":[{"ordinal":1,"promptText":"...","helpText":null,"expectedDurationSec":90,"suggestedDurationSec":75,"maxDurationSec":120}, ...]}`,
    "",
    "Field notes:",
    "- promptText: the full spoken prompt (what the learner should address out loud).",
    "- helpText: optional short coaching line.",
    "- expectedDurationSec / suggestedDurationSec / maxDurationSec: optional seconds for oral length guidance.",
  ]
    .filter(Boolean)
    .join("\n");
}
