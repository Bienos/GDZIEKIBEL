import { computeOpeningStatus } from '../opening-hours/compute-status';
import type { NormalizedOpeningHours, OpeningStatus } from '../opening-hours/types';
import { approxWalkingMinutes } from './walking-time';
import type {
  AccessType,
  ConfidenceLevel,
  FeatureState,
  PaymentMethods,
  PriceState,
} from './types';

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
  /** The bounded-grammar parse of `charge` (TASK-014), or `null`. */
  priceAmountMinor: number | null;
  currency: string | null;
  confidenceLevel: ConfidenceLevel;
  accessType: AccessType;
  wheelchair: FeatureState;
  changingTable: FeatureState;
  unisex: FeatureState;
  open24h: boolean | null;
  openingHoursNormalized: NormalizedOpeningHours | null;
  /** May be `null` for a pre-TASK-014 row; never null in the API response. */
  paymentMethods: PaymentMethods | null;
}

export interface NearbyToiletResult {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  approxWalkingMinutes: number;
  /**
   * Computed by `computeOpeningStatus` (TASK-013) from the row's stored
   * hours, `now`, and `confidenceLevel`. See
   * `docs/adr/0009-opening-hours-status.md`.
   */
  openingStatus: OpeningStatus;
  /** The raw fact `TASK-016`'s open-24h filter reads; `openingStatus`
   * above is the computed, moment-evaluated status, a different concept. */
  open24h: boolean | null;
  priceState: PriceState;
  priceAmountMinor: number | null;
  currency: string | null;
  confidenceLevel: ConfidenceLevel;
  accessType: AccessType;
  features: {
    wheelchair: FeatureState;
    changingTable: FeatureState;
    unisex: FeatureState;
  };
  /**
   * Never `null`: an unrecorded flag is `'unknown'`
   * (`docs/adr/0010-price-and-payment-normalisation.md`), the same rule
   * every other feature field already follows.
   */
  paymentMethods: PaymentMethods;
}

const UNKNOWN_PAYMENT_METHODS: PaymentMethods = {
  cash: 'unknown',
  cards: 'unknown',
  coins: 'unknown',
};

/**
 * `now` is an explicit parameter — never read internally via `Date.now()` —
 * so every result in one API response reflects the same evaluated moment,
 * and so this stays testable against fixed instants.
 */
export function toNearbyResult(row: NearbyToiletRow, now: Date): NearbyToiletResult {
  return {
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    distanceMeters: row.distanceMeters,
    approxWalkingMinutes: approxWalkingMinutes(row.distanceMeters),
    openingStatus: computeOpeningStatus(
      { open24h: row.open24h, openingHoursNormalized: row.openingHoursNormalized },
      row.confidenceLevel,
      now,
    ),
    open24h: row.open24h,
    priceState: row.priceState,
    priceAmountMinor: row.priceAmountMinor,
    currency: row.currency,
    confidenceLevel: row.confidenceLevel,
    accessType: row.accessType,
    features: {
      wheelchair: row.wheelchair,
      changingTable: row.changingTable,
      unisex: row.unisex,
    },
    paymentMethods: row.paymentMethods ?? UNKNOWN_PAYMENT_METHODS,
  };
}
