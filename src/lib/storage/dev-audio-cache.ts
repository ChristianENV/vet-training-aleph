import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getServerEnv } from "@/lib/config/env";
import { isR2Configured } from "@/lib/storage/r2-upload";

const CACHE_DIR = "vet-training-aleph-dev-audio";

function extFromMime(mime: string | null | undefined): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  return "webm";
}

/** When R2 is off, final audio is only a DB placeholder — persist bytes locally so transcription retry can reload them. */
export function isDevAudioCacheActive(): boolean {
  return !isR2Configured(getServerEnv());
}

function cacheFilePath(
  sessionId: string,
  sessionQuestionId: string,
  contentType: string | null | undefined,
): string {
  return path.join(
    os.tmpdir(),
    CACHE_DIR,
    sessionId,
    `${sessionQuestionId}.${extFromMime(contentType)}`,
  );
}

export async function writeDevAudioCache(
  sessionId: string,
  sessionQuestionId: string,
  buffer: Buffer,
  contentType: string | null | undefined,
): Promise<void> {
  if (!isDevAudioCacheActive()) return;
  const filePath = cacheFilePath(sessionId, sessionQuestionId, contentType);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
}

export async function readDevAudioCache(
  sessionId: string,
  sessionQuestionId: string,
  contentType: string | null | undefined,
): Promise<Buffer | null> {
  if (!isDevAudioCacheActive()) return null;
  const filePath = cacheFilePath(sessionId, sessionQuestionId, contentType);
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}
