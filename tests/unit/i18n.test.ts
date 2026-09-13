import { describe, expect, it } from 'vitest';
import { DICTIONARIES, getDictionary } from '@/lib/i18n/dictionaries';
import { DEFAULT_LOCALE, isLocale, LOCALES, LOCALE_NAMES, otherLocale } from '@/lib/i18n';

/**
 * A missing translation must fail the build, not fall back silently to Polish
 * in front of an English reader. These tests are the enforcement.
 */
describe('locales', () => {
  it('offers Polish and English, with Polish as the default', () => {
    expect(LOCALES).toEqual(['pl', 'en']);
    expect(DEFAULT_LOCALE).toBe('pl');
  });

  it('accepts only supported locales', () => {
    expect(isLocale('pl')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale('')).toBe(false);
    expect(isLocale('PL')).toBe(false);
  });

  it('switches to the other locale', () => {
    expect(otherLocale('pl')).toBe('en');
    expect(otherLocale('en')).toBe('pl');
  });

  it('names every locale in the switch', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_NAMES[locale]).toBeTruthy();
    }
  });
});

describe('dictionaries', () => {
  const keys = Object.keys(DICTIONARIES.pl).sort();

  it('defines every locale', () => {
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale]).toBeDefined();
    }
  });

  it.each(LOCALES)('gives %s exactly the same keys as Polish', (locale) => {
    expect(Object.keys(DICTIONARIES[locale]).sort()).toEqual(keys);
  });

  it.each(LOCALES)('leaves no empty string in %s', (locale) => {
    for (const [key, value] of Object.entries(DICTIONARIES[locale])) {
      expect(value.trim(), `${locale}.${key} is empty`).not.toBe('');
    }
  });

  it('does not ship Polish text as the English translation', () => {
    // Catches a copy-paste that leaves the source language in place. The
    // wordmark is deliberately not a dictionary entry, so it is not affected.
    for (const [key, value] of Object.entries(DICTIONARIES.en)) {
      const polish = DICTIONARIES.pl[key as keyof typeof DICTIONARIES.pl];
      if (key === 'metaTitle') continue;
      expect(value, `en.${key} still matches the Polish string`).not.toBe(polish);
    }
  });

  it('returns the dictionary for a locale', () => {
    expect(getDictionary('en').stage).toBe('Project foundation');
    expect(getDictionary('pl').stage).toBe('Fundament projektu');
  });
});
