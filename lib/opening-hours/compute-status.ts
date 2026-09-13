import type { ConfidenceLevel } from '../toilets/types';
import type { NormalizedOpeningHours, OpeningStatus } from './types';
import { toWarsawMoment } from './warsaw-time';

function isOpenNow(
  normalized: NormalizedOpeningHours,
  weekday: number,
  minutesSinceMidnight: number,
): boolean {
  const yesterday = (weekday + 6) % 7;

  for (const rule of normalized.rules) {
    if (rule.closed) continue;

    if (rule.days.includes(weekday)) {
      for (const range of rule.ranges) {
        if (minutesSinceMidnight >= range.start && minutesSinceMidnight < range.end) return true;
      }
    }

    // A range from yesterday's rule that crosses midnight (end > 1440) can
    // still cover this early-morning moment.
    if (rule.days.includes(yesterday)) {
      const wrapped = minutesSinceMidnight + 24 * 60;
      for (const range of rule.ranges) {
        if (range.end > 24 * 60 && wrapped >= range.start && wrapped < range.end) return true;
      }
    }
  }

  return false;
}

/**
 * Computes the current opening status from an already-normalised weekly
 * schedule (or `open24h`), an explicit moment, and the toilet's
 * `confidence_level`. `docs/adr/0009-opening-hours-status.md` records why
 * a real day/time match is only reported as plain `OPEN`/`CLOSED` when
 * `confidenceLevel` is `'high'`; anything else — every toilet ingested
 * today — is qualified into `LIKELY_OPEN`/`LIKELY_CLOSED`.
 *
 * `now` is an explicit parameter, not read internally, so this stays pure
 * and testable against fixed instants.
 */
export function computeOpeningStatus(
  input: { open24h: boolean | null; openingHoursNormalized: NormalizedOpeningHours | null },
  confidenceLevel: ConfidenceLevel,
  now: Date,
): OpeningStatus {
  let open: boolean;
  if (input.open24h === true) {
    open = true;
  } else if (input.openingHoursNormalized !== null) {
    const { weekday, minutesSinceMidnight } = toWarsawMoment(now);
    open = isOpenNow(input.openingHoursNormalized, weekday, minutesSinceMidnight);
  } else {
    return 'UNKNOWN';
  }

  const qualified = confidenceLevel !== 'high';
  if (open) return qualified ? 'LIKELY_OPEN' : 'OPEN';
  return qualified ? 'LIKELY_CLOSED' : 'CLOSED';
}
