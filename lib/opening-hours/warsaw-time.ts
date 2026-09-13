/** The Warsaw-local weekday and time of day for one instant. */
export interface WarsawMoment {
  /** 0 = Monday ... 6 = Sunday, matching OSM's Mo..Su week order. */
  weekday: number;
  minutesSinceMidnight: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/**
 * Derives the Warsaw-local weekday and time of day for a UTC instant, via
 * `Intl.DateTimeFormat` rather than a date library
 * (`docs/adr/0009-opening-hours-status.md`) — the runtime's own timezone
 * database handles the CET/CEST daylight-saving transition correctly.
 */
export function toWarsawMoment(now: Date): WarsawMoment {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Warsaw',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(now);
  const weekdayPart = parts.find((part) => part.type === 'weekday')?.value ?? '';
  const hourPart = parts.find((part) => part.type === 'hour')?.value ?? '0';
  const minutePart = parts.find((part) => part.type === 'minute')?.value ?? '0';

  const weekday = WEEKDAY_INDEX[weekdayPart];
  if (weekday === undefined) {
    throw new Error(`Unrecognised weekday from Intl.DateTimeFormat: "${weekdayPart}"`);
  }

  return {
    weekday,
    minutesSinceMidnight: Number(hourPart) * 60 + Number(minutePart),
  };
}
