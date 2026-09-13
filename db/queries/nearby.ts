import type { Pool } from 'pg';
import type { NearbyToiletRow } from '@/lib/toilets/nearby-response';

/**
 * Finds active toilets within a radius of a point, nearest first.
 *
 * Only `canonical_status = 'active'` rows are eligible: a temporarily closed
 * or removed toilet must never appear in a nearby result, independent of
 * whatever ranking `TASK-009` later adds on top of this plain distance
 * order. `ARCHITECTURE.md` section 6's geospatial query strategy.
 */

/** Server-controlled result cap. Not part of the request; see ADR 0006. */
export const MAX_NEARBY_RESULTS = 30;

interface NearbyRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance_meters: number;
  price_state: NearbyToiletRow['priceState'];
  price_amount_minor: NearbyToiletRow['priceAmountMinor'];
  currency: NearbyToiletRow['currency'];
  confidence_level: NearbyToiletRow['confidenceLevel'];
  access_type: NearbyToiletRow['accessType'];
  wheelchair: NearbyToiletRow['wheelchair'];
  changing_table: NearbyToiletRow['changingTable'];
  unisex: NearbyToiletRow['unisex'];
  open_24h: NearbyToiletRow['open24h'];
  opening_hours_normalized: NearbyToiletRow['openingHoursNormalized'];
  payment_methods: NearbyToiletRow['paymentMethods'];
}

export async function findNearbyToilets(
  pool: Pool,
  params: { lat: number; lng: number; radiusMeters: number },
): Promise<NearbyToiletRow[]> {
  const result = await pool.query<NearbyRow>(
    `SELECT
       id,
       name,
       ST_X(geom::geometry) AS lng,
       ST_Y(geom::geometry) AS lat,
       ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters,
       price_state,
       price_amount_minor,
       currency,
       confidence_level,
       access_type,
       wheelchair,
       changing_table,
       unisex,
       open_24h,
       opening_hours_normalized,
       payment_methods
     FROM toilets
     WHERE canonical_status = 'active'
       AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
     ORDER BY distance_meters ASC
     LIMIT $4`,
    [params.lng, params.lat, params.radiusMeters, MAX_NEARBY_RESULTS],
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    lat: Number(row.lat),
    lng: Number(row.lng),
    distanceMeters: Number(row.distance_meters),
    priceState: row.price_state,
    priceAmountMinor: row.price_amount_minor,
    currency: row.currency,
    confidenceLevel: row.confidence_level,
    accessType: row.access_type,
    wheelchair: row.wheelchair,
    changingTable: row.changing_table,
    unisex: row.unisex,
    open24h: row.open_24h,
    openingHoursNormalized: row.opening_hours_normalized,
    paymentMethods: row.payment_methods,
  }));
}
