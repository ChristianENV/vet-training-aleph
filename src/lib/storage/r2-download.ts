import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { ServerEnv } from "@/lib/config/env";
import { isR2Configured } from "@/lib/storage/r2-upload";

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

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) throw new Error("Empty object body");
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  const stream = body as AsyncIterable<Uint8Array>;
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function downloadObjectFromR2(env: ServerEnv, key: string): Promise<Buffer> {
  if (!isR2Configured(env)) {
    throw new Error("R2 is not configured — cannot download stored audio");
  }
  const client = createClient(env);
  const out = await client.send(
    new GetObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: key,
    }),
  );
  return streamToBuffer(out.Body);
}
