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
    templateQuestionId: z.string().cuid(),
    transcriptText: z.string().trim().max(32_000).optional(),
    audioUrl: z.string().trim().max(2000).optional(),
    durationSec: z.coerce.number().int().min(0).max(86400).optional(),
  })
  .refine(
    (d) => {
      const t = d.transcriptText?.trim();
      const a = d.audioUrl?.trim();
      return Boolean(t || a);
    },
    { message: "Provide transcriptText and/or audioUrl" },
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
