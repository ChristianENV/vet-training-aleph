/**
 * Next.js route handlers run on Node; multipart values are Blob-like but may not pass `instanceof File`.
 * Use this so finalize (and similar) routes still read binary parts reliably.
 */
export async function readFormDataBinaryPart(
  entry: unknown,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (typeof entry === "string") return null;
  if (entry == null || typeof entry !== "object") return null;
  if (typeof (entry as Blob).arrayBuffer !== "function") return null;
  const blob = entry as Blob;
  if (blob.size < 1) return null;
  const buffer = Buffer.from(await blob.arrayBuffer());
  const contentType =
    typeof (entry as File).type === "string" && (entry as File).type.length > 0
      ? (entry as File).type
      : blob.type && blob.type.length > 0
        ? blob.type
        : "application/octet-stream";
  return { buffer, contentType };
}
