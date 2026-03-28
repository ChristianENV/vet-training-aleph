import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { ServerEnv } from "@/lib/config/env";

const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function isR2Configured(env: ServerEnv): boolean {
  return Boolean(
    env.R2_ENDPOINT && env.R2_BUCKET && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY,
  );
}

function createClient(env: ServerEnv): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });
}

export type UploadBody = Buffer | Uint8Array;

/**
 * Puts one object to R2 with up to 3 attempts (exponential backoff).
 */
export async function uploadToR2WithRetry(
  env: ServerEnv,
  input: { key: string; body: UploadBody; contentType: string },
): Promise<void> {
  if (!isR2Configured(env)) {
    throw new Error("R2 is not configured");
  }
  const client = createClient(env);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET!,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
      return;
    } catch (e) {
      lastErr = e;
      const hint = e instanceof Error ? e.message : String(e);
      console.warn(
        `[r2-upload] PutObject attempt ${attempt}/${MAX_ATTEMPTS} failed key=${input.key.slice(0, 120)}: ${hint}`,
      );
      if (attempt < MAX_ATTEMPTS) {
        await sleep(200 * 2 ** (attempt - 1));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("R2 upload failed");
}
