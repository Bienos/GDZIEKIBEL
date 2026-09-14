import type { EventName } from './types';

/**
 * Client-side call to `POST /api/analytics/events` (TASK-023). Never
 * throws and never rejects: a caller can fire this without awaiting it,
 * and a failure here must never look like the feature it is attached to
 * broke. Mirrors `lib/reports/submit-report.ts`'s shape, minus the
 * meaningful failure a caller would need to react to — there is nothing
 * for a caller to do with an analytics failure except ignore it.
 */
export async function reportEvent(
  eventName: EventName,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    await fetchImpl('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName }),
    });
  } catch {
    // Deliberately swallowed — see the doc comment above.
  }
}
