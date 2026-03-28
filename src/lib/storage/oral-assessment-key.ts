import { userSafeSlug } from "@/lib/strings/user-safe-slug";

export function extensionForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("wav")) return "wav";
  return "bin";
}

/**
 * oral-assessments/{yyyy}/{mm}/{dd}/{userSafe}/{sessionId}/question-{ordinal}/final-{timestamp}.{ext}
 */
export function buildOralAssessmentObjectKey(input: {
  sessionId: string;
  ordinal: number;
  userName: string | null;
  userEmail: string;
  mimeType: string;
}): string {
  const userSafe = userSafeSlug(input.userName, input.userEmail);
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const ts = now.getTime();
  const ext = extensionForMime(input.mimeType);
  return `oral-assessments/${y}/${m}/${d}/${userSafe}/${input.sessionId}/question-${input.ordinal}/final-${ts}.${ext}`;
}
