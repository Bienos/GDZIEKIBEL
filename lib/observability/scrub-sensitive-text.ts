const COORDINATE_PAIR_PATTERN = /-?\d{1,3}\.\d{2,},\s*-?\d{1,3}\.\d{2,}/g;
const COORDINATE_KEY_VALUE_PATTERN =
  /\b(?:lat(?:itude)?|lng|lon(?:gitude)?)\b["']?\s*[:=]\s*-?\d{1,3}(?:\.\d+)?/gi;

/**
 * A connection string's `user:password@` segment, e.g. from a `DATABASE_URL`
 * (`postgres://user:pass@host:5432/db`) surfacing inside a driver's own
 * error message. Only the credential segment is redacted, not the whole
 * URL — the scheme/host/path are still useful for debugging and carry
 * nothing secret.
 */
const CREDENTIAL_URL_PATTERN = /:\/\/[^\s/@]+:[^\s/@]+@/g;

/** A `password`/`secret`/`api key`/`token`-keyed value, however it is
 * spelled or quoted — the generic shape of a secret accidentally landing
 * in free text, not tied to any one provider. */
const SECRET_KEY_VALUE_PATTERN =
  /\b(?:password|passwd|pwd|secret|api[_-]?key|token)\b["']?\s*[:=]\s*["']?[^\s"',}]+["']?/gi;

/**
 * Redacts anything shaped like a coordinate, a URL-embedded credential, or
 * a keyed secret from free text before it reaches a log line (TASK-024,
 * `docs/adr/0019-runtime-error-logging.md`; TASK-029's security review,
 * `ARCHITECTURE.md` section 16: "exposed database credentials" as an MVP
 * threat priority; section 8: "Sentry/request tracing must be configured
 * to avoid body capture for location endpoints"). This is a second,
 * defense-in-depth layer — no call site ever hands this project's logger
 * a request body, a coordinate, or a connection string directly — for the
 * one case that still carries text this project did not itself construct:
 * an unexpected error's own message or stack (for example, a Postgres
 * driver error that echoes the connection string it failed to use).
 *
 * Bounded and conservative like `parseCharge`/`parseOpeningHours`: a
 * comma-separated decimal pair, a `lat`/`lng`/`lon`-keyed number, a
 * `user:password@` URL segment, or a `password`/`secret`/`token`-keyed
 * value is redacted; a bare decimal or an ordinary URL with no embedded
 * credential is left alone, since over-redacting would defeat the point
 * of logging the error at all.
 */
export function scrubSensitiveText(text: string): string {
  return text
    .replace(COORDINATE_PAIR_PATTERN, '[REDACTED_COORDINATES]')
    .replace(COORDINATE_KEY_VALUE_PATTERN, '[REDACTED_COORDINATES]')
    .replace(CREDENTIAL_URL_PATTERN, '://[REDACTED_CREDENTIALS]@')
    .replace(SECRET_KEY_VALUE_PATTERN, '[REDACTED_SECRET]');
}
