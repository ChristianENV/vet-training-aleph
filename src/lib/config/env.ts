import { z } from "zod";

/**
 * Validated server-side environment. Call from server components, route handlers, and server-only modules.
 * TODO: split public vs server-only vars if you add NEXT_PUBLIC_* client config.
 */
const serverEnvSchema = z.object({
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
  /** Cloudflare R2 (S3-compatible). When unset, final audio uses dev placeholder keys (no upload). */
  R2_ENDPOINT: z.string().url().optional(),
  R2_BUCKET: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  /** Optional public base for signed URLs later; not exposed to learners in UI. */
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
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
