const COORDINATE_PAIR_PATTERN = /-?\d{1,3}\.\d{2,},\s*-?\d{1,3}\.\d{2,}/g;
const COORDINATE_KEY_VALUE_PATTERN =
  /\b(?:lat(?:itude)?|lng|lon(?:gitude)?)\b["']?\s*[:=]\s*-?\d{1,3}(?:\.\d+)?/gi;

/**
 * Redacts anything shaped like a coordinate from free text before it
 * reaches a log line (TASK-024, `docs/adr/0019-runtime-error-logging.md`;
 * `ARCHITECTURE.md` section 8: "Sentry/request tracing must be configured
 * to avoid body capture for location endpoints"). This is a second,
 * defense-in-depth layer — no call site ever hands this project's logger
 * a request body or a coordinate directly — for the one case that still
 * carries text this project did not itself construct: an unexpected
 * error's own message or stack.
 *
 * Bounded and conservative like `parseCharge`/`parseOpeningHours`: a
 * comma-separated decimal pair, or a `lat`/`lng`/`lon`-keyed number, is
 * redacted; a bare decimal on its own (a price, an ETA, a distance) is
 * left alone, since redacting every number in an error message would
 * defeat the point of logging it at all.
 */
export function scrubSensitiveText(text: string): string {
  return text
    .replace(COORDINATE_PAIR_PATTERN, '[REDACTED_COORDINATES]')
    .replace(COORDINATE_KEY_VALUE_PATTERN, '[REDACTED_COORDINATES]');
}
