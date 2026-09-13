import { isWithinWarsawBbox } from '@/lib/geo/warsaw';

/**
 * Validation of raw Overpass elements before anything is normalised or stored.
 * Implements `docs/contracts/osm-toilets-source.md` section 7.
 *
 * A rejected element never reaches the database. The result carries only the
 * element key and a reason, so callers can log it without logging the body.
 */

export type OsmElementType = 'node' | 'way' | 'relation';

export interface ValidElement {
  type: OsmElementType;
  id: number;
  version: number;
  position: { lat: number; lon: number };
  tags: Record<string, string>;
  /** ISO 8601 last-edit time, or null when the source did not include it. */
  timestamp: string | null;
}

export type ValidationResult =
  { ok: true; element: ValidElement } | { ok: false; key: string; reason: string };

export const MAX_TAG_VALUE_LENGTH = 4096;

const ELEMENT_TYPES: readonly string[] = ['node', 'way', 'relation'];

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

export function elementKey(type: unknown, id: unknown): string {
  return `${typeof type === 'string' ? type : '?'}/${isPositiveInteger(id) ? id : '?'}`;
}

export function validateElement(input: unknown): ValidationResult {
  const raw = asRecord(input);
  if (!raw) return { ok: false, key: '?/?', reason: 'element is not an object' };

  const key = elementKey(raw.type, raw.id);

  if (typeof raw.type !== 'string' || !ELEMENT_TYPES.includes(raw.type)) {
    return { ok: false, key, reason: 'type is not node, way or relation' };
  }
  const type = raw.type as OsmElementType;

  if (!isPositiveInteger(raw.id)) return { ok: false, key, reason: 'id is not a positive integer' };
  if (!isPositiveInteger(raw.version)) {
    return { ok: false, key, reason: 'version is not a positive integer' };
  }

  const positionSource = type === 'node' ? raw : asRecord(raw.center);
  const lat = positionSource?.lat;
  const lon = positionSource?.lon;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) {
    return { ok: false, key, reason: 'position is missing or not numeric' };
  }
  if (!isWithinWarsawBbox({ lat, lon })) {
    return { ok: false, key, reason: 'position is outside the coarse Warsaw box' };
  }

  const tags = asRecord(raw.tags);
  if (!tags) return { ok: false, key, reason: 'tags is not an object' };
  const cleanTags: Record<string, string> = {};
  for (const [tagKey, tagValue] of Object.entries(tags)) {
    if (typeof tagValue !== 'string') {
      return { ok: false, key, reason: `tag ${tagKey} is not a string` };
    }
    if (tagValue.length > MAX_TAG_VALUE_LENGTH) {
      return { ok: false, key, reason: `tag ${tagKey} exceeds ${MAX_TAG_VALUE_LENGTH} characters` };
    }
    cleanTags[tagKey] = tagValue;
  }

  const timestamp = typeof raw.timestamp === 'string' ? raw.timestamp : null;

  return {
    ok: true,
    element: {
      type,
      id: raw.id,
      version: raw.version,
      position: { lat, lon },
      tags: cleanTags,
      timestamp,
    },
  };
}
