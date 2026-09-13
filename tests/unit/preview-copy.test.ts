import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { distanceLine, openingStatusLabel, priceLabel } from '@/lib/toilets/preview-copy';

const pl = getDictionary('pl');
const en = getDictionary('en');

describe('openingStatusLabel', () => {
  it('reports the unknown-status copy, the only reachable value today', () => {
    expect(openingStatusLabel('UNKNOWN', pl)).toBe('STATUS NIEPEWNY');
    expect(openingStatusLabel('UNKNOWN', en)).toBe('STATUS UNKNOWN');
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

describe('distanceLine', () => {
  it('rounds distance and joins it with the walking-time estimate', () => {
    expect(distanceLine(239.6, 3, pl)).toBe('240 M · ~3 MIN PIESZO');
    expect(distanceLine(239.6, 3, en)).toBe('240 m · ~3 min walk');
  });
});
