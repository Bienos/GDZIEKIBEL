import { approxWalkingMinutes } from './walking-time';
import type { AccessType, ConfidenceLevel, FeatureState, PriceState } from './types';

/**
 * Shapes one database row from `db/queries/nearby.ts` into the API response
 * item `docs/adr/0006-nearby-api-contract.md` defines. Kept as a pure
 * function, apart from the query itself, so the shaping rules — the ones
 * that matter for `PRODUCT.md` section 9's "never collapse unknown" rule —
 * are unit-testable without a database.
 */
export interface NearbyToiletRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  priceState: PriceState;
  confidenceLevel: ConfidenceLevel;
  accessType: AccessType;
  wheelchair: FeatureState;
  changingTable: FeatureState;
  unisex: FeatureState;
}

export interface NearbyToiletResult {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  approxWalkingMinutes: number;
  /**
   * Always "UNKNOWN" until TASK-013 computes a real value. Not a bug: see
   * ADR 0006. Kept as a literal type so a future task changing this is a
   * visible type change here, not a silent behaviour change.
   */
  openingStatus: 'UNKNOWN';
  priceState: PriceState;
  confidenceLevel: ConfidenceLevel;
  accessType: AccessType;
  features: {
    wheelchair: FeatureState;
    changingTable: FeatureState;
    unisex: FeatureState;
  };
}

export function toNearbyResult(row: NearbyToiletRow): NearbyToiletResult {
  return {
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    distanceMeters: row.distanceMeters,
    approxWalkingMinutes: approxWalkingMinutes(row.distanceMeters),
    openingStatus: 'UNKNOWN',
    priceState: row.priceState,
    confidenceLevel: row.confidenceLevel,
    accessType: row.accessType,
    features: {
      wheelchair: row.wheelchair,
      changingTable: row.changingTable,
      unisex: row.unisex,
    },
  };
}
