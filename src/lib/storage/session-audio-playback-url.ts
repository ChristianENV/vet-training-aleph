import type { ServerEnv } from "@/lib/config/env";

/**
 * Builds a browser-playable URL for a stored final answer when the bucket is exposed via a public base
 * (e.g. Cloudflare r2.dev custom domain). Does not call R2 at runtime — only string composition.
 *
 * For private buckets, omit `R2_PUBLIC_BASE_URL` / `R2_PUBLIC_URL` and return null here until a signed-URL
 * API exists.
 */
export function resolveSessionAudioPlaybackUrl(
  env: ServerEnv,
  meta: {
    finalAudioStorageKey: string | null | undefined;
    finalAudioProvider: string | null | undefined;
  },
): string | null {
  const key = meta.finalAudioStorageKey?.trim();
  if (!key) return null;

  const publicBase = env.R2_PUBLIC_BASE_URL?.trim();
  if (!publicBase) return null;

  if (meta.finalAudioProvider !== "r2") {
    return null;
  }

  const base = publicBase.replace(/\/+$/, "");
  const path = key.replace(/^\/+/, "");
  return `${base}/${path}`;
}
