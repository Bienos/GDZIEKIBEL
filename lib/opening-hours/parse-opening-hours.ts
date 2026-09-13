import type { NormalizedOpeningHours, OpeningHoursRule } from './types';

const DAY_CODES: Record<string, number> = { Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4, Sa: 5, Su: 6 };

const TIME_RANGE_RE = /^([0-2]\d):([0-5]\d)-([0-2]\d):([0-5]\d)$/;

function parseDayToken(token: string): number[] | null {
  const rangeMatch = /^([A-Za-z]{2})-([A-Za-z]{2})$/.exec(token);
  if (rangeMatch) {
    const start = DAY_CODES[rangeMatch[1] as string];
    const end = DAY_CODES[rangeMatch[2] as string];
    if (start === undefined || end === undefined) return null;

    const days: number[] = [];
    let day = start;
    for (let steps = 0; steps <= 7; steps += 1) {
      days.push(day);
      if (day === end) return days;
      day = (day + 1) % 7;
    }
    return null; // never reached end within one week: malformed
  }

  const single = DAY_CODES[token];
  return single === undefined ? null : [single];
}

function parseDays(dayPart: string): number[] | null {
  const tokens = dayPart
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;

  const days = new Set<number>();
  for (const token of tokens) {
    const parsed = parseDayToken(token);
    if (parsed === null) return null;
    for (const day of parsed) days.add(day);
  }
  return [...days].sort((a, b) => a - b);
}

function parseTimeRanges(timePart: string): { start: number; end: number }[] | null {
  const tokens = timePart
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;

  const ranges: { start: number; end: number }[] = [];
  for (const token of tokens) {
    const match = TIME_RANGE_RE.exec(token);
    if (!match) return null;

    const start = Number(match[1]) * 60 + Number(match[2]);
    let end = Number(match[3]) * 60 + Number(match[4]);
    if (start >= 24 * 60) return null;
    if (end <= start) end += 24 * 60;
    ranges.push({ start, end });
  }
  return ranges;
}

/**
 * Parses the bounded subset of the OSM `opening_hours` micro-syntax
 * `docs/adr/0009-opening-hours-status.md` records: `;`-separated rules,
 * each `<days> <time-ranges>` or `<days> off`/`<days> closed`, where
 * `<days>` is a comma-separated list of single day codes or day ranges and
 * `<time-ranges>` is a comma-separated list of `HH:MM-HH:MM`, a range
 * crossing midnight included. `24/7` is recognised separately by
 * `deriveOpeningHours` below.
 *
 * Anything outside this subset — public holidays (`PH`), date/season
 * ranges, comments, a rule with no recognisable day part — fails the
 * *whole* string (returns `null`) rather than applying a partial reading.
 */
export function parseOpeningHours(raw: string): NormalizedOpeningHours | null {
  const ruleStrings = raw
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  if (ruleStrings.length === 0) return null;

  const rules: OpeningHoursRule[] = [];
  for (const ruleString of ruleStrings) {
    const spaceIndex = ruleString.indexOf(' ');
    if (spaceIndex === -1) return null;

    const days = parseDays(ruleString.slice(0, spaceIndex));
    if (days === null) return null;

    const timePart = ruleString.slice(spaceIndex + 1).trim();
    if (/^(off|closed)$/i.test(timePart)) {
      rules.push({ days, closed: true, ranges: [] });
      continue;
    }

    const ranges = parseTimeRanges(timePart);
    if (ranges === null) return null;
    rules.push({ days, closed: false, ranges });
  }

  return { rules };
}

/**
 * The entry point an ingestion adapter calls with one source's raw hours
 * text: recognises `24/7` as a distinct case (`open24h`), otherwise
 * delegates to `parseOpeningHours`. `null` input (no hours data at all)
 * yields both fields `null`.
 */
export function deriveOpeningHours(raw: string | null): {
  open24h: boolean | null;
  openingHoursNormalized: NormalizedOpeningHours | null;
} {
  if (raw === null) return { open24h: null, openingHoursNormalized: null };
  if (raw === '24/7') return { open24h: true, openingHoursNormalized: null };
  return { open24h: null, openingHoursNormalized: parseOpeningHours(raw) };
}
