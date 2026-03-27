/**
 * Auth.js may build absolute URLs from AUTH_URL / NEXTAUTH_URL. If those point at
 * localhost while the app runs on another host, signIn/signOut redirects break.
 * Keep navigation on the current origin using relative paths only.
 */

/** Only allow same-app relative paths (blocks open redirects and absolute URLs). */
export function sanitizeLoginCallbackUrl(raw: string | undefined, defaultPath = "/dashboard"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return defaultPath;
  return raw;
}

/**
 * Prefer Auth.js `url` when it matches the browser origin; otherwise use the safe relative fallback.
 */
export function sameOriginRedirectPath(candidateUrl: string | null | undefined, fallbackRelative: string): string {
  const fallback = sanitizeLoginCallbackUrl(fallbackRelative);
  if (typeof window === "undefined") return fallback;
  if (!candidateUrl?.trim()) return fallback;
  try {
    const resolved = new URL(candidateUrl, window.location.origin);
    if (resolved.origin === window.location.origin) {
      return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}
