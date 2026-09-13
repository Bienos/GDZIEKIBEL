import type { NearbyToiletResult } from './nearby-response';

/**
 * Pure reconciliation between a previous set of rendered marker ids and a
 * new toilet list: what needs adding, what needs removing. Kept apart from
 * `maplibre-gl` so it is testable without a map, a DOM, or WebGL.
 *
 * An id present in both is left alone. A toilet whose underlying data
 * changed between two fetches with the same id is not specially handled —
 * this task's fetch runs at most twice (mount, then a location grant), and
 * merging in place is a refinement for whenever that stops being true.
 */
export interface MarkerDiff {
  toAdd: NearbyToiletResult[];
  toRemove: string[];
}

export function diffMarkers(
  previousIds: ReadonlySet<string>,
  nextToilets: NearbyToiletResult[],
): MarkerDiff {
  const nextIds = new Set(nextToilets.map((toilet) => toilet.id));

  return {
    toAdd: nextToilets.filter((toilet) => !previousIds.has(toilet.id)),
    toRemove: [...previousIds].filter((id) => !nextIds.has(id)),
  };
}
