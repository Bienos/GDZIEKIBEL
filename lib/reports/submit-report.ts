import type { IssueType } from './types';

/**
 * Client-side call to `POST /api/toilets/:id/reports` (TASK-020). Never
 * throws; every failure — network, non-2xx, or an unexpected body shape —
 * resolves to a typed failure so a caller cannot forget to handle it.
 * Mirrors `lib/toilets/fetch-nearby.ts`'s shape.
 */

export interface SubmitReportParams {
  toiletId: string;
  issueType: IssueType;
  /** Omitted or blank is sent as `undefined`, never an empty string — the
   * server already treats blank the same as omitted, but there is no
   * reason to send a value it would just discard. */
  note?: string;
}

export type SubmitReportResult = { ok: true } | { ok: false; message: string };

export async function submitReport(
  params: SubmitReportParams,
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitReportResult> {
  try {
    const trimmedNote = params.note?.trim();
    const response = await fetchImpl(`/api/toilets/${params.toiletId}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issueType: params.issueType,
        ...(trimmedNote ? { note: trimmedNote } : {}),
      }),
    });

    if (!response.ok) {
      return { ok: false, message: `Request failed with status ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
