/**
 * A fast, pre-parse guard against oversized request bodies (TASK-029,
 * `ARCHITECTURE.md` section 16: "oversized/malformed input" as an MVP
 * threat priority). Every write endpoint in this project has a small,
 * fixed-shape body — the largest, a report's optional 1000-character
 * `note` (`REPORT_NOTE_MAX_LENGTH`), comfortably fits inside this ceiling
 * with room to spare. Checked from the `content-length` header before the
 * body is ever read, so an oversized request never reaches
 * `request.json()`'s own buffering/parse work.
 *
 * A request that omits `content-length` (chunked transfer-encoding) is
 * not caught here — this is a fast-path guard, not a complete enforcement
 * mechanism. The hosting platform's own request size limit
 * (`ARCHITECTURE.md` section 2: Vercel) is the backstop for that case.
 */
export const MAX_REQUEST_BODY_BYTES = 8 * 1024;

export function exceedsMaxRequestBodyBytes(
  request: Request,
  maxBytes: number = MAX_REQUEST_BODY_BYTES,
): boolean {
  const header = request.headers.get('content-length');
  if (!header) return false;
  const length = Number(header);
  return Number.isFinite(length) && length > maxBytes;
}
