/**
 * Public site origin for canonical URLs and Open Graph absolute links.
 * Set `NEXT_PUBLIC_APP_URL` in production/staging (e.g. `https://app.example.com`).
 * On Vercel, `VERCEL_URL` is used when the public URL is unset (preview/production host).
 * Local dev defaults to `http://localhost:3000`.
 */
function normalizeOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return normalizeOrigin(explicit);

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return normalizeOrigin(vercel);

  return "http://localhost:3000";
}

export function getMetadataBase(): URL {
  return new URL(getSiteUrl());
}
