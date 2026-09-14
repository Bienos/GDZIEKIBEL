import { FALLBACK_TOILET_NAME } from './fallback-name';

/**
 * Cross-source matching (TASK-022, `docs/adr/0017-cross-source-deduplication.md`).
 * Pure: no database, no I/O. `db/queries/dedup-candidates.ts` supplies the
 * spatial candidates this operates on.
 *
 * All three thresholds are a first, unvalidated pass — no real second
 * source has ever been reachable from this project's sessions (see the
 * ADR). Isolated here, as named constants, specifically so they are easy
 * to revise once real cross-source data exists.
 */

/** How far away an existing, differently-sourced toilet can be and still
 * count as a candidate worth comparing at all. */
export const SPATIAL_CANDIDATE_RADIUS_METERS = 30;

/** How close a candidate must be, in addition to a strong name match, to
 * auto-merge rather than merely being flagged. */
export const AUTO_MERGE_DISTANCE_METERS = 15;

/** Minimum name-similarity score (0-100) required to auto-merge. */
export const AUTO_MERGE_NAME_SIMILARITY_THRESHOLD = 80;

export interface SpatialCandidate {
  toiletId: string;
  name: string;
  distanceMeters: number;
}

export type MatchDecision =
  | { kind: 'new' }
  | { kind: 'merge'; toiletId: string; score: number }
  | { kind: 'ambiguous'; candidates: { toiletId: string; score: number }[] };

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Classic dynamic-programming edit distance. No dependency: this is one
 * well-understood algorithm, not a reason to add a string-matching library. */
function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) distances[i]![0] = i;
  for (let j = 0; j < cols; j += 1) distances[0]![j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      distances[i]![j] = Math.min(
        distances[i - 1]![j]! + 1,
        distances[i]![j - 1]! + 1,
        distances[i - 1]![j - 1]! + cost,
      );
    }
  }

  return distances[rows - 1]![cols - 1]!;
}

/**
 * `null` when either name is missing or is the fallback placeholder
 * (`FALLBACK_TOILET_NAME`, "Toaleta"): two anonymous facilities sharing
 * the same generic label match on nothing real, so this is "not
 * comparable", never a false 100.
 */
export function computeNameSimilarity(a: string | null, b: string | null): number | null {
  if (a === null || b === null) return null;
  if (a === FALLBACK_TOILET_NAME || b === FALLBACK_TOILET_NAME) return null;

  const normalizedA = normalize(a);
  const normalizedB = normalize(b);
  if (normalizedA.length === 0 || normalizedB.length === 0) return null;
  if (normalizedA === normalizedB) return 100;

  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  return Math.round((1 - distance / maxLength) * 100);
}

/**
 * `candidates` must already be restricted to toilets backed by a source
 * other than the incoming record's own (`db/queries/dedup-candidates.ts`'s
 * job) and within `SPATIAL_CANDIDATE_RADIUS_METERS` — this function does
 * not re-check either.
 */
export function decideMatch(
  newRecordName: string | null,
  candidates: SpatialCandidate[],
): MatchDecision {
  if (candidates.length === 0) return { kind: 'new' };

  const scored = candidates.map((candidate) => ({
    toiletId: candidate.toiletId,
    distanceMeters: candidate.distanceMeters,
    score: computeNameSimilarity(newRecordName, candidate.name),
  }));

  const confidentMerge = scored.find(
    (candidate) =>
      candidate.distanceMeters <= AUTO_MERGE_DISTANCE_METERS &&
      candidate.score !== null &&
      candidate.score >= AUTO_MERGE_NAME_SIMILARITY_THRESHOLD,
  );
  if (confidentMerge) {
    return { kind: 'merge', toiletId: confidentMerge.toiletId, score: confidentMerge.score! };
  }

  return {
    kind: 'ambiguous',
    candidates: scored.map((candidate) => ({
      toiletId: candidate.toiletId,
      score: candidate.score ?? 0,
    })),
  };
}
