import { describe, expect, it } from 'vitest';
import {
  AUTO_MERGE_DISTANCE_METERS,
  AUTO_MERGE_NAME_SIMILARITY_THRESHOLD,
  computeNameSimilarity,
  decideMatch,
  type SpatialCandidate,
} from '@/lib/ingest/dedup';

describe('computeNameSimilarity', () => {
  it('is 100 for identical names', () => {
    expect(computeNameSimilarity('Toaleta Miejska', 'Toaleta Miejska')).toBe(100);
  });

  it('is 100 for the same name modulo case and surrounding whitespace', () => {
    expect(computeNameSimilarity('  Toaleta Miejska  ', 'toaleta miejska')).toBe(100);
  });

  it('is lower for a genuinely different name', () => {
    const score = computeNameSimilarity('Toaleta Miejska', 'Kibel na Dworcu');
    expect(score).not.toBeNull();
    expect(score!).toBeLessThan(50);
  });

  it('is null when either name is missing', () => {
    expect(computeNameSimilarity(null, 'Toaleta Miejska')).toBeNull();
    expect(computeNameSimilarity('Toaleta Miejska', null)).toBeNull();
    expect(computeNameSimilarity(null, null)).toBeNull();
  });

  it('is null when either side is the fallback placeholder, never a false 100', () => {
    expect(computeNameSimilarity('Toaleta', 'Toaleta')).toBeNull();
    expect(computeNameSimilarity('Toaleta', 'Toaleta Miejska')).toBeNull();
  });
});

const CANDIDATE_AT = (distanceMeters: number, name: string): SpatialCandidate => ({
  toiletId: `toilet-${distanceMeters}-${name}`,
  name,
  distanceMeters,
});

describe('decideMatch', () => {
  it('is "new" when there are no spatial candidates at all', () => {
    expect(decideMatch('Toaleta Miejska', [])).toEqual({ kind: 'new' });
  });

  it('auto-merges a close candidate with a strong name match', () => {
    const candidate = CANDIDATE_AT(AUTO_MERGE_DISTANCE_METERS, 'Toaleta Miejska');
    const result = decideMatch('Toaleta Miejska', [candidate]);

    expect(result).toEqual({ kind: 'merge', toiletId: candidate.toiletId, score: 100 });
  });

  it('does not merge a close candidate whose name similarity is below the threshold', () => {
    const candidate = CANDIDATE_AT(5, 'Kompletnie Inna Nazwa');
    const result = decideMatch('Toaleta Miejska', [candidate]);

    expect(result.kind).toBe('ambiguous');
  });

  it('does not merge a name-matching candidate that is farther than the merge distance', () => {
    const candidate = CANDIDATE_AT(AUTO_MERGE_DISTANCE_METERS + 1, 'Toaleta Miejska');
    const result = decideMatch('Toaleta Miejska', [candidate]);

    expect(result.kind).toBe('ambiguous');
  });

  it('never auto-merges on a placeholder-name match alone, even very close', () => {
    const candidate = CANDIDATE_AT(1, 'Toaleta');
    const result = decideMatch('Toaleta', [candidate]);

    expect(result.kind).toBe('ambiguous');
  });

  it('flags every spatial candidate as ambiguous, not just the closest, when none clears the merge bar', () => {
    const near = CANDIDATE_AT(10, 'Coś Innego');
    const far = CANDIDATE_AT(25, 'Zupełnie Coś Innego');
    const result = decideMatch('Toaleta Miejska', [near, far]);

    expect(result.kind).toBe('ambiguous');
    if (result.kind !== 'ambiguous') return;
    expect(result.candidates.map((c) => c.toiletId).sort()).toEqual(
      [near.toiletId, far.toiletId].sort(),
    );
  });

  it('reports the real similarity score on an ambiguous candidate, not a fabricated one', () => {
    const candidate = CANDIDATE_AT(20, 'Toaleta Miejska');
    const result = decideMatch('Toaleta Miejska', [candidate]);

    expect(result.kind).toBe('ambiguous');
    if (result.kind !== 'ambiguous') return;
    expect(result.candidates[0]).toEqual({ toiletId: candidate.toiletId, score: 100 });
  });

  it('picks the first candidate meeting the merge bar exactly at the similarity threshold', () => {
    // "Toaleta na Placu" vs "Toaleta przy Placu" — close enough in spelling
    // to actually land at or above the documented threshold.
    const candidate = CANDIDATE_AT(1, 'Toaleta na Placu');
    const score = computeNameSimilarity('Toaleta na Placu', candidate.name)!;
    expect(score).toBeGreaterThanOrEqual(AUTO_MERGE_NAME_SIMILARITY_THRESHOLD);

    expect(decideMatch('Toaleta na Placu', [candidate])).toEqual({
      kind: 'merge',
      toiletId: candidate.toiletId,
      score,
    });
  });
});
