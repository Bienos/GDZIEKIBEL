/**
 * Coarse geography for Warsaw.
 *
 * This bounding box is the one the TASK-002 probe used. It is generous: it
 * includes parts of neighbouring municipalities and is only a first filter for
 * obviously wrong coordinates. The real area test is against the Warsaw
 * administrative boundary and belongs to TASK-004, which also records the
 * boundary relation it uses.
 */
export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export const WARSAW_BBOX: BoundingBox = {
  south: 52.0979,
  west: 20.8512,
  north: 52.3679,
  east: 21.2711,
};

/** True when the point lies inside the coarse Warsaw box, edges included. */
export function isWithinWarsawBbox(point: { lat: number; lon: number }): boolean {
  return (
    point.lat >= WARSAW_BBOX.south &&
    point.lat <= WARSAW_BBOX.north &&
    point.lon >= WARSAW_BBOX.west &&
    point.lon <= WARSAW_BBOX.east
  );
}
