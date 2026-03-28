import { z } from "zod";
import { SessionStatus } from "@/generated/prisma/enums";

export const createSessionBodySchema = z.object({
  templateId: z.string().cuid(),
});

export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;

/** POST .../start — empty body allowed */
export const startSessionBodySchema = z.object({}).strict();

export const submitSessionResponseBodySchema = z
  .object({
    sessionQuestionId: z.string().cuid(),
    transcriptText: z.string().trim().max(32_000).optional(),
    finalAudioStorageKey: z.string().trim().max(2000).optional(),
    finalAudioDurationSec: z.coerce.number().int().min(0).max(86400).optional(),
    /** Present when a voice answer was captured in-browser; upload happens later (e.g. R2 on finalize). */
    finalAudioMimeType: z.string().trim().max(200).optional(),
    finalAudioBytes: z.coerce.number().int().min(0).max(200_000_000).optional(),
  })
  .refine(
    (d) => {
      const t = d.transcriptText?.trim();
      const k = d.finalAudioStorageKey?.trim();
      const mime = d.finalAudioMimeType?.trim();
      const hasVoiceMeta =
        (d.finalAudioDurationSec ?? 0) > 0 && typeof mime === "string" && mime.length > 0;
      return Boolean(t || k || hasVoiceMeta);
    },
    {
      message:
        "Provide transcriptText, finalAudioStorageKey, or recorded audio metadata (duration + mime type)",
    },
  );

export type SubmitSessionResponseBody = z.infer<typeof submitSessionResponseBodySchema>;

export const completeSessionBodySchema = z.object({}).strict();

export const cancelSessionBodySchema = z.object({}).strict();

export const sessionListQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(100).optional().default(30),
  status: z.nativeEnum(SessionStatus).optional(),
  /** Only when caller has `sessions:view_any`: filter to this user’s sessions */
  userId: z.string().cuid().optional(),
});

export type SessionListQuery = z.infer<typeof sessionListQuerySchema>;
