/** A request body read with a hard byte limit, before any JSON parsing.
 *  `req.json()` reads the whole body first, so a route's schema limits only
 *  applied after a body of any size had been read and parsed. This stops at
 *  the limit, whatever Content-Length claims. Call it after the rate limit. */
export type ReadJsonLimitedResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "too-large" | "invalid" };

export async function readJsonLimited(req: Request, maxBytes: number): Promise<ReadJsonLimitedResult> {
  const contentLength = req.headers.get("content-length");
  if (contentLength !== null && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
    return { ok: false, reason: "too-large" };
  }

  const reader = req.body?.getReader();
  if (!reader) return parseJson(new Uint8Array());

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel().catch(() => {});
        return { ok: false, reason: "too-large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid" };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return parseJson(bytes);
}

function parseJson(bytes: Uint8Array): ReadJsonLimitedResult {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
