import { describe, expect, it } from 'vitest';
import {
  ACCESS_CONFIDENCE_PENALTY_METERS,
  rankNearbyToilets,
  rankingScore,
} from '@/lib/toilets/rank-nearby';
import { ACCESS_TYPES } from '@/lib/toilets/types';

describe('ACCESS_CONFIDENCE_PENALTY_METERS', () => {
  it('names every access type from the schema enum, none left as an implicit default', () => {
    expect(Object.keys(ACCESS_CONFIDENCE_PENALTY_METERS).sort()).toEqual([...ACCESS_TYPES].sort());
  });

  it('never applies a negative penalty', () => {
    for (const penalty of Object.values(ACCESS_CONFIDENCE_PENALTY_METERS)) {
      expect(penalty).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('rankingScore', () => {
  it('is distance plus the access-type penalty, nothing else', () => {
    expect(rankingScore({ distanceMeters: 300, accessType: 'unknown' })).toBe(
      300 + ACCESS_CONFIDENCE_PENALTY_METERS.unknown,
    );
    expect(rankingScore({ distanceMeters: 300, accessType: 'public_unconditional' })).toBe(300);
  });
});

describe('rankNearbyToilets', () => {
  it('sorts by plain distance when every access type is equally confident', () => {
    const ranked = rankNearbyToilets([
      { id: 'far', distanceMeters: 500, accessType: 'public_unconditional' },
      { id: 'near', distanceMeters: 100, accessType: 'public_unconditional' },
    ]);

    expect(ranked.map((toilet) => toilet.id)).toEqual(['near', 'far']);
  });

  it('lets a slightly farther high-confidence public toilet outrank a closer uncertain one (PRODUCT.md section 11)', () => {
    const ranked = rankNearbyToilets([
      { id: 'closer-uncertain', distanceMeters: 300, accessType: 'unknown' },
      { id: 'farther-confident', distanceMeters: 400, accessType: 'public_unconditional' },
    ]);

    expect(ranked.map((toilet) => toilet.id)).toEqual(['farther-confident', 'closer-uncertain']);
  });

  it('never excludes a not_public toilet, only deprioritises it', () => {
    const ranked = rankNearbyToilets([
      { id: 'locked', distanceMeters: 50, accessType: 'not_public' },
      { id: 'public', distanceMeters: 400, accessType: 'public_unconditional' },
    ]);

    expect(ranked.map((toilet) => toilet.id)).toEqual(['public', 'locked']);
    expect(ranked).toHaveLength(2);
  });

  it('breaks a tied score by real distance, nearer first', () => {
    // 300 + 150 (unknown) === 450 + 0 (public_unconditional)
    const ranked = rankNearbyToilets([
      { id: 'farther', distanceMeters: 450, accessType: 'public_unconditional' },
      { id: 'nearer', distanceMeters: 300, accessType: 'unknown' },
    ]);

    expect(rankingScore(ranked[0]!)).toBe(rankingScore(ranked[1]!));
    expect(ranked.map((toilet) => toilet.id)).toEqual(['nearer', 'farther']);
  });

  it('does not mutate the input array', () => {
    const input = [
      { id: 'a', distanceMeters: 500, accessType: 'public_unconditional' as const },
      { id: 'b', distanceMeters: 100, accessType: 'public_unconditional' as const },
    ];
    const inputCopy = [...input];

    rankNearbyToilets(input);

    expect(input).toEqual(inputCopy);
  });

  it('treats public_paid the same as public_unconditional: price is a separate concern from access confidence', () => {
    expect(ACCESS_CONFIDENCE_PENALTY_METERS.public_paid).toBe(
      ACCESS_CONFIDENCE_PENALTY_METERS.public_unconditional,
    );
  });
});
