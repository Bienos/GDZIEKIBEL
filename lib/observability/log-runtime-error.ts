import { scrubSensitiveText } from './scrub-sensitive-text';

export const LOG_CONTEXTS = [
  'POST /api/toilets/nearby',
  'POST /api/toilets/[id]/reports',
  'POST /api/analytics/events',
  'db/queries/analytics.ts:insertAnalyticsEvent',
  'db/client.ts:pool',
] as const;

export type LogContext = (typeof LOG_CONTEXTS)[number];

interface LoggedError {
  level: 'error';
  source: LogContext;
  name: string;
  message: string;
  timestamp: string;
}

/**
 * The one place a runtime error becomes observable (TASK-024,
 * `docs/adr/0019-runtime-error-logging.md`). No call site passes a
 * request, a parsed body, or a coordinate here — only a fixed context
 * label and whatever was actually thrown — so nothing reaches this
 * function that could leak one by construction. `error.message`/`.stack`
 * still pass through `scrubSensitiveText` as a second layer, since an
 * unexpected error is the one place text this project did not itself
 * write could still appear.
 *
 * Emits one structured JSON line to `console.error`, which Vercel's own
 * log pipeline already captures — no external provider, account, or
 * environment variable required. A real Sentry (or equivalent)
 * integration can replace this function's body later without any call
 * site changing.
 */
export function logRuntimeError(source: LogContext, error: unknown): void {
  const name = error instanceof Error ? error.name : 'UnknownError';
  const rawMessage = error instanceof Error ? (error.stack ?? error.message) : String(error);

  const entry: LoggedError = {
    level: 'error',
    source,
    name,
    message: scrubSensitiveText(rawMessage),
    timestamp: new Date().toISOString(),
  };

  console.error(JSON.stringify(entry));
}
