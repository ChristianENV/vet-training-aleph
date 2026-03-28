/**
 * Picks a single supported audio MIME type for MediaRecorder.
 * Prefers efficient browser-native containers (webm/opus, mp4/aac on Safari).
 */
const CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

export function pickAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined") {
    return "audio/webm";
  }
  for (const c of CANDIDATES) {
    if (MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return "";
}
