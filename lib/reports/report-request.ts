import { z } from 'zod';
import { ISSUE_TYPES, type IssueType } from './types';

/**
 * Validates and normalises a `POST /api/toilets/:id/reports` request body
 * (TASK-020, `docs/adr/0015-toilet-reports.md`). Mirrors
 * `lib/toilets/nearby-request.ts`'s validate-before-querying pattern.
 */

/** A first, defensible pass — see the ADR's "Not decided here". */
export const REPORT_NOTE_MAX_LENGTH = 1000;

const reportRequestBodySchema = z.strictObject({
  issueType: z.enum(ISSUE_TYPES),
  note: z.string().trim().max(REPORT_NOTE_MAX_LENGTH).optional(),
});

export interface ReportParams {
  issueType: IssueType;
  /** Trimmed; an omitted or blank note is `null`, never an empty string —
   * one way to say "no note", not two. */
  note: string | null;
}

export type ReportRequestValidation =
  { ok: true; params: ReportParams } | { ok: false; message: string };

const toiletIdSchema = z.uuid();

export type ToiletIdValidation = { ok: true; id: string } | { ok: false; message: string };

/** Validates the `:id` path segment's shape before any query runs — a
 * malformed id is a `400`, an id that is well-formed but absent is the
 * route's own `404` (`docs/adr/0015-toilet-reports.md`). */
export function parseToiletId(id: string): ToiletIdValidation {
  const result = toiletIdSchema.safeParse(id);
  return result.success ? { ok: true, id: result.data } : { ok: false, message: 'invalid id' };
}

/** Never echoes the submitted `note` in a failure message: only which
 * field was wrong and why, from the Zod issue itself. */
export function parseReportRequest(input: unknown): ReportRequestValidation {
  const result = reportRequestBodySchema.safeParse(input);

  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') || '(root)';
    return { ok: false, message: `${path}: ${issue?.message ?? 'invalid request body'}` };
  }

  const { issueType, note } = result.data;

  return {
    ok: true,
    params: {
      issueType,
      note: note !== undefined && note !== '' ? note : null,
    },
  };
}
