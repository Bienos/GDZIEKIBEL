const CHARGE_RE = /^(\d+(?:[.,]\d{1,2})?)\s*(\S+)$/;

const CURRENCY_ALIASES: Record<string, string> = {
  pln: 'PLN',
  zł: 'PLN',
  zl: 'PLN',
  eur: 'EUR',
  usd: 'USD',
};

/**
 * Parses the bounded `<amount> <currency>` grammar
 * `docs/adr/0010-price-and-payment-normalisation.md` records: one amount
 * (an optional 1-2 digit decimal part, `.` or `,`), one currency token from
 * a small fixed set. Anything else — a range, missing currency, free text
 * — fails the whole string, returning `null` rather than a guess.
 *
 * Source-agnostic: any adapter with an amount-plus-currency string can
 * reuse this, unlike the OSM-specific tag readers in
 * `lib/ingest/osm/normalize.ts`.
 */
export function parseCharge(raw: string | null): { amountMinor: number; currency: string } | null {
  if (raw === null) return null;

  const match = CHARGE_RE.exec(raw.trim());
  const [, amountToken, currencyToken] = match ?? [];
  if (amountToken === undefined || currencyToken === undefined) return null;

  const currency = CURRENCY_ALIASES[currencyToken.toLowerCase()];
  if (currency === undefined) return null;

  const amount = Number(amountToken.replace(',', '.'));
  return { amountMinor: Math.round(amount * 100), currency };
}
