import { createHash } from 'node:crypto';

/**
 * The analytics ingest endpoint's rate limiter (TASK-029,
 * `docs/adr/0023-analytics-rate-limiting.md`): pure window/key logic
 * here, the database round trip in
 * `db/queries/analytics-rate-limit.ts`. `now` is always explicit, never
 * read internally, so this stays testable against fixed instants — the
 * same rule as `lib/reports/rate-limit.ts`.
 *
 * Deliberately a sibling module, not a shared import from
 * `lib/reports/rate-limit.ts`: the two limiters happen to share the same
 * window/hash shape today, but `docs/adr/0016-report-rate-limiting.md`'s
 * five-per-hour figure and this module's figure are independent tuning
 * decisions for endpoints with very different legitimate traffic, and
 * `AGENTS.md` rules out refactoring the already-shipped, tested report
 * limiter as part of this task's own scope.
 */

/** A first, defensible pass — much higher than the report endpoint's,
 * since a single legitimate session can fire several of these events
 * (`app_opened`, a location outcome, several `toilet_selected`s, a
 * `navigation_clicked`) and a shared IP (NAT, a school, a corporate
 * network) multiplies that by everyone behind it. See the ADR's "Not
 * decided here". */
export const ANALYTICS_RATE_LIMIT_MAX_REQUESTS_PER_WINDOW = 120;

const WINDOW_MILLISECONDS = 60 * 60 * 1000; // one hour
const RETENTION_MILLISECONDS = 24 * WINDOW_MILLISECONDS; // one day

/** Floors `now` to its containing one-hour window. */
export function rateLimitWindowStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / WINDOW_MILLISECONDS) * WINDOW_MILLISECONDS);
}

/** Windows starting before this instant are stale and safe to delete. */
export function rateLimitRetentionCutoff(now: Date): Date {
  return new Date(now.getTime() - RETENTION_MILLISECONDS);
}

/** Seconds until the current window ends — for a `Retry-After` header. */
export function secondsUntilWindowEnds(now: Date): number {
  const windowEnd = rateLimitWindowStart(now).getTime() + WINDOW_MILLISECONDS;
  return Math.ceil((windowEnd - now.getTime()) / 1000);
}

/**
 * Never the raw IP: a one-way SHA-256 hash, so the counter table cannot be
 * read back into an address list. Unsalted — see
 * `docs/adr/0016-report-rate-limiting.md`'s "Not decided here" for why
 * that is a known, accepted first-pass limitation shared by both
 * limiters.
 */
export function hashClientKey(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

/**
 * Reads the client's IP from `x-forwarded-for`, the header Vercel's edge
 * network sets. `null` when the header is absent (always present behind
 * Vercel; a local request without it falls back to one shared "unknown"
 * bucket in the route, never bypasses the limiter).
 */
export function extractClientIp(request: Request): string | null {
  const header = request.headers.get('x-forwarded-for');
  if (!header) return null;
  const first = header.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}
