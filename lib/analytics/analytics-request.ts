import { z } from 'zod';
import { EVENT_NAMES, type EventName } from './types';

/**
 * Validates a `POST /api/analytics/events` request body (TASK-023).
 * Mirrors `lib/reports/report-request.ts`'s validate-before-querying
 * pattern — the whole body is one field, so there is little to validate,
 * but an unrecognised `eventName` must still be rejected, not silently
 * dropped or stored as free text.
 */
const analyticsRequestBodySchema = z.strictObject({
  eventName: z.enum(EVENT_NAMES),
});

export type AnalyticsRequestValidation =
  { ok: true; eventName: EventName } | { ok: false; message: string };

export function parseAnalyticsRequest(input: unknown): AnalyticsRequestValidation {
  const result = analyticsRequestBodySchema.safeParse(input);

  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') || '(root)';
    return { ok: false, message: `${path}: ${issue?.message ?? 'invalid request body'}` };
  }

  return { ok: true, eventName: result.data.eventName };
}
