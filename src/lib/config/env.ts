import { z } from "zod";

const SESSION_Q_MIN = 1;
const SESSION_Q_MAX = 25;

/** Defaults when SESSION_GENERATION_* env vars are unset (explicit env always wins). */
const SESSION_QUESTION_DEFAULTS_LOCAL = { min: 4, max: 4 } as const;
const SESSION_QUESTION_DEFAULTS_NON_LOCAL = { min: 5, max: 10 } as const;

function parseOptionalBoundedQuestionCount(
  raw: string | undefined,
  label: string,
): number | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const n = parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || String(n) !== raw.trim()) {
    throw new Error(`${label} must be a whole number between ${SESSION_Q_MIN} and ${SESSION_Q_MAX}`);
  }
  if (n < SESSION_Q_MIN || n > SESSION_Q_MAX) {
    throw new Error(`${label} must be between ${SESSION_Q_MIN} and ${SESSION_Q_MAX}`);
  }
  return n;
}

/**
 * Validated server-side environment. Call from server components, route handlers, and server-only modules.
 * TODO: split public vs server-only vars if you add NEXT_PUBLIC_* client config.
 */
const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    /** PostgreSQL connection string for Prisma + `pg` adapter. */
    DATABASE_URL: z.string().min(1),
    AUTH_SECRET: z.string().min(1),
    AUTH_URL: z.string().url().optional(),
    AUTH_TRUST_HOST: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    NEXTAUTH_URL: z.string().url().optional(),
    NEXTAUTH_SECRET: z.string().optional(),
    /** Used only by prisma/seed.ts for the protected developer account. */
    DEV_USER_EMAIL: z.string().email().optional(),
    DEV_USER_PASSWORD: z.string().min(8).optional(),
    /** OpenAI (server-only): session evaluation and future turn generation. */
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_EVAL_MODEL: z.string().min(1).optional().default("gpt-4o-mini"),
    /** Model for per-session question generation (defaults to OPENAI_EVAL_MODEL). */
    OPENAI_QUESTIONS_MODEL: z.string().min(1).optional(),
    /** OpenAI speech-to-text model for final answer transcription (default whisper-1). */
    OPENAI_TRANSCRIPTION_MODEL: z.string().min(1).optional().default("whisper-1"),
    /**
     * Deployment flavor (optional). `local` with unset SESSION_GENERATION_* uses the local question-count default.
     * Often set in `.env.local`; does not replace `NODE_ENV`.
     */
    APP_ENV: z.string().optional(),
    /** Override GPT question count (optional). See transform for defaults when unset. */
    SESSION_GENERATION_MIN_QUESTIONS: z.string().optional(),
    SESSION_GENERATION_MAX_QUESTIONS: z.string().optional(),
    /** Cloudflare R2 (S3-compatible). When unset, final audio uses dev placeholder keys (no upload). */
    R2_ENDPOINT: z.string().url().optional(),
    R2_BUCKET: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    /** Optional public base for signed URLs later; not exposed to learners in UI. */
    R2_PUBLIC_BASE_URL: z.string().url().optional(),
  })
  .transform((data) => {
    const explicitMin = parseOptionalBoundedQuestionCount(
      data.SESSION_GENERATION_MIN_QUESTIONS,
      "SESSION_GENERATION_MIN_QUESTIONS",
    );
    const explicitMax = parseOptionalBoundedQuestionCount(
      data.SESSION_GENERATION_MAX_QUESTIONS,
      "SESSION_GENERATION_MAX_QUESTIONS",
    );

    const appEnvNormalized = data.APP_ENV?.trim().toLowerCase();
    const useLocalQuestionDefaults =
      appEnvNormalized === "local" || data.NODE_ENV === "development";
    const defaultBounds = useLocalQuestionDefaults
      ? SESSION_QUESTION_DEFAULTS_LOCAL
      : SESSION_QUESTION_DEFAULTS_NON_LOCAL;
    const defaultMin = defaultBounds.min;
    const defaultMax = defaultBounds.max;

    const sessionGenerationMinQuestions = explicitMin ?? defaultMin;
    const sessionGenerationMaxQuestions = explicitMax ?? defaultMax;

    if (sessionGenerationMinQuestions > sessionGenerationMaxQuestions) {
      throw new Error(
        "SESSION_GENERATION_MIN_QUESTIONS must be less than or equal to SESSION_GENERATION_MAX_QUESTIONS",
      );
    }

    const {
      SESSION_GENERATION_MIN_QUESTIONS: _a,
      SESSION_GENERATION_MAX_QUESTIONS: _b,
      ...rest
    } = data;

    return {
      ...rest,
      sessionGenerationMinQuestions,
      sessionGenerationMaxQuestions,
    };
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment configuration: ${JSON.stringify(msg)}`);
  }
  cached = parsed.data;
  return parsed.data;
}
