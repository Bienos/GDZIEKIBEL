import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/lib/i18n/dictionaries';
import {
  distanceLine,
  openingStatusLabel,
  openingStatusVariant,
  priceAmountLabel,
  priceLabel,
} from '@/lib/toilets/preview-copy';

const pl = getDictionary('pl');
const en = getDictionary('en');

describe('openingStatusLabel', () => {
  it('reports each of the five real states distinctly', () => {
    expect(openingStatusLabel('OPEN', pl)).toBe('OTWARTY');
    expect(openingStatusLabel('CLOSED', pl)).toBe('ZAMKNIĘTY');
    expect(openingStatusLabel('LIKELY_OPEN', pl)).toBe('RACZEJ OTWARTY');
    expect(openingStatusLabel('LIKELY_CLOSED', pl)).toBe('RACZEJ ZAMKNIĘTY');
    expect(openingStatusLabel('UNKNOWN', pl)).toBe('STATUS NIEPEWNY');
  });

  it('never ships the Polish string as the English one', () => {
    for (const status of ['OPEN', 'CLOSED', 'LIKELY_OPEN', 'LIKELY_CLOSED', 'UNKNOWN'] as const) {
      expect(openingStatusLabel(status, en)).not.toBe(openingStatusLabel(status, pl));
    }
  });
});

describe('openingStatusVariant', () => {
  it('maps OPEN and CLOSED to their own colour variant', () => {
    expect(openingStatusVariant('OPEN')).toBe('open');
    expect(openingStatusVariant('CLOSED')).toBe('closed');
  });

  it('maps every uncertain state — LIKELY_OPEN, LIKELY_CLOSED, UNKNOWN — to uncertain', () => {
    expect(openingStatusVariant('LIKELY_OPEN')).toBe('uncertain');
    expect(openingStatusVariant('LIKELY_CLOSED')).toBe('uncertain');
    expect(openingStatusVariant('UNKNOWN')).toBe('uncertain');
  });
});

describe('priceLabel', () => {
  it('reports each of the three real price states distinctly', () => {
    expect(priceLabel('free', pl)).toBe('ZA DARMO');
    expect(priceLabel('paid', pl)).toBe('PŁATNY');
    expect(priceLabel('unknown', pl)).toBe('CENA NIEZNANA');
  });

  it('never collapses unknown into free or paid', () => {
    expect(priceLabel('unknown', en)).not.toBe(priceLabel('free', en));
    expect(priceLabel('unknown', en)).not.toBe(priceLabel('paid', en));
  });
});

describe('priceAmountLabel', () => {
  it('shows a whole-number amount without decimals', () => {
    expect(priceAmountLabel('paid', 200, 'PLN', pl)).toBe('2 PLN');
  });

  it('shows a fractional amount with two decimal places', () => {
    expect(priceAmountLabel('paid', 450, 'PLN', pl)).toBe('4.50 PLN');
  });

  it('falls back to the generic paid badge when the amount did not parse', () => {
    expect(priceAmountLabel('paid', null, null, pl)).toBe('PŁATNY');
  });

  it('ignores an amount if priceState is not paid, never showing a stale figure', () => {
    expect(priceAmountLabel('free', 200, 'PLN', pl)).toBe('ZA DARMO');
    expect(priceAmountLabel('unknown', 200, 'PLN', pl)).toBe('CENA NIEZNANA');
  });
});

describe('distanceLine', () => {
  it('rounds distance and joins it with the walking-time estimate', () => {
    expect(distanceLine(239.6, 3, pl)).toBe('240 M · ~3 MIN PIESZO');
    expect(distanceLine(239.6, 3, en)).toBe('240 m · ~3 min walk');
  });
});
