/**
 * Enumerated values of the canonical toilet model.
 *
 * These mirror the SQL types in `db/migrations/*_toilet-schema.sql` member for
 * member, and `tests/unit/toilets-types.test.ts` fails if the two drift.
 *
 * Every list that describes an attribute the product must never infer has an
 * explicit `unknown` member. Absence of information is represented by that
 * member, never by `no`, `free` or `open`. PRODUCT.md section 9 is the rule.
 */

/** How a member of the public gets in. From the research, section 1.6. */
export const ACCESS_TYPES = [
  'public_unconditional',
  'public_paid',
  'customers_only',
  'purchase_required',
  'ask_staff',
  'key_required',
  'code_required',
  'ticket_required',
  'not_public',
  'unknown',
] as const;
export type AccessType = (typeof ACCESS_TYPES)[number];

export const PRICE_STATES = ['free', 'paid', 'unknown'] as const;
export type PriceState = (typeof PRICE_STATES)[number];

/** Presence of a facility feature. `limited` exists because sources use it. */
export const FEATURE_STATES = ['yes', 'no', 'limited', 'unknown'] as const;
export type FeatureState = (typeof FEATURE_STATES)[number];

export const CANONICAL_STATUSES = ['active', 'temporarily_closed', 'removed'] as const;
export type CanonicalStatus = (typeof CANONICAL_STATUSES)[number];

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const INGESTION_RUN_STATUSES = ['running', 'succeeded', 'failed'] as const;
export type IngestionRunStatus = (typeof INGESTION_RUN_STATUSES)[number];

/**
 * The three payment facts `docs/adr/0010-price-and-payment-normalisation.md`
 * normalises from OSM's `payment:*` tags (TASK-014): not the full
 * namespace, the three the research's cited user problem — needing coins,
 * not knowing whether cash or card works — actually calls for. Never
 * `null`: an unrecorded flag is `'unknown'`, the same rule as every other
 * feature field.
 */
export interface PaymentMethods {
  cash: FeatureState;
  cards: FeatureState;
  coins: FeatureState;
}

/**
 * Name of each SQL enum type paired with its TypeScript list, so the agreement
 * test can read the migration and compare without knowing the members itself.
 */
export const SQL_ENUM_MIRROR = {
  access_type: ACCESS_TYPES,
  price_state: PRICE_STATES,
  feature_state: FEATURE_STATES,
  canonical_status: CANONICAL_STATUSES,
  confidence_level: CONFIDENCE_LEVELS,
  ingestion_run_status: INGESTION_RUN_STATUSES,
} as const;
