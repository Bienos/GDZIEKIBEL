import { describe, expect, it } from 'vitest';
import { parseCharge } from '@/lib/toilets/parse-charge';

describe('parseCharge', () => {
  it('parses a whole-number amount with a space before the currency', () => {
    expect(parseCharge('2 PLN')).toEqual({ amountMinor: 200, currency: 'PLN' });
  });

  it('parses a decimal amount with a period', () => {
    expect(parseCharge('4.50 PLN')).toEqual({ amountMinor: 450, currency: 'PLN' });
  });

  it('parses a decimal amount with a comma', () => {
    expect(parseCharge('4,50 PLN')).toEqual({ amountMinor: 450, currency: 'PLN' });
  });

  it('normalises the Polish zł symbol to PLN, with or without a space', () => {
    expect(parseCharge('2zł')).toEqual({ amountMinor: 200, currency: 'PLN' });
    expect(parseCharge('2 zł')).toEqual({ amountMinor: 200, currency: 'PLN' });
    expect(parseCharge('2 ZŁ')).toEqual({ amountMinor: 200, currency: 'PLN' });
  });

  it('parses EUR and USD', () => {
    expect(parseCharge('0.50 EUR')).toEqual({ amountMinor: 50, currency: 'EUR' });
    expect(parseCharge('1 USD')).toEqual({ amountMinor: 100, currency: 'USD' });
  });

  it('fails on a range, never guessing an amount', () => {
    expect(parseCharge('2-4 PLN')).toBeNull();
  });

  it('fails on a missing or unrecognised currency', () => {
    expect(parseCharge('2')).toBeNull();
    expect(parseCharge('2 GBP')).toBeNull();
  });

  it('fails on free text', () => {
    expect(parseCharge('donation')).toBeNull();
    expect(parseCharge('ask staff')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(parseCharge(null)).toBeNull();
  });
});
