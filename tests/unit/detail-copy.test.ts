import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { confidenceLabel, featureStateLabel } from '@/lib/toilets/detail-copy';

const pl = getDictionary('pl');
const en = getDictionary('en');

describe('featureStateLabel', () => {
  it('reports each of the four states distinctly', () => {
    expect(featureStateLabel('yes', pl)).toBe('TAK');
    expect(featureStateLabel('no', pl)).toBe('NIE');
    expect(featureStateLabel('limited', pl)).toBe('OGRANICZONE');
    expect(featureStateLabel('unknown', pl)).toBe('NIEZNANE');
  });

  it('never collapses limited or unknown into yes or no', () => {
    const labels = new Set(
      (['yes', 'no', 'limited', 'unknown'] as const).map((state) => featureStateLabel(state, en)),
    );
    expect(labels.size).toBe(4);
  });
});

describe('confidenceLabel', () => {
  it('reports each of the three levels distinctly', () => {
    expect(confidenceLabel('high', pl)).toBe('PEWNOŚĆ DANYCH: WYSOKA');
    expect(confidenceLabel('medium', pl)).toBe('PEWNOŚĆ DANYCH: ŚREDNIA');
    expect(confidenceLabel('low', pl)).toBe('PEWNOŚĆ DANYCH: NISKA');
  });

  it('reports the real low confidence every current toilet carries, not a fabricated higher one', () => {
    expect(confidenceLabel('low', en)).toBe('DATA CONFIDENCE: LOW');
    expect(confidenceLabel('low', en)).not.toBe(confidenceLabel('high', en));
  });
});
