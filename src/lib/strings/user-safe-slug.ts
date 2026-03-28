/**
 * Short filesystem-safe segment from display name or email (for storage keys).
 */
export function userSafeSlug(name: string | null | undefined, email: string): string {
  const raw = (name?.trim() || email.split("@")[0] || "learner").toLowerCase();
  const cleaned = raw
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return cleaned || "learner";
}
