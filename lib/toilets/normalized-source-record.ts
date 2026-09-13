import { z } from 'zod';
import { ACCESS_TYPES, FEATURE_STATES, PRICE_STATES } from './types';

/**
 * The record an ingestion adapter emits for one source element.
 *
 * This is `docs/contracts/osm-toilets-source.md` section 6 in code. It is the
 * boundary between "what a source said" and "what the product stores", so it is
 * deliberately strict:
 *
 * - every field is required, so an adapter must write `unknown` or `null` on
 *   purpose rather than leave a field out and have it defaulted;
 * - unknown keys are rejected, so a typo cannot silently drop a value;
 * - nothing here parses opening hours, resolves access from a venue type, or
 *   turns an absent tag into `no`. Those are later tasks and explicit rules.
 *
 * Raw fields carry what the source said, unchanged, for the source record.
 */

const featureState = z.enum(FEATURE_STATES);

/** WGS84 position. Ranges only; the Warsaw boundary check is TASK-004's. */
export const positionSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const normalizedSourceRecordSchema = z.strictObject({
  /** Adapter identity, for example `osm`. Never empty. */
  sourceName: z.string().min(1),
  /** Stable per source, for example `node/123456`. Never empty. */
  sourceRecordId: z.string().min(1),
  /** The source's own version marker, when it has one. */
  sourceVersion: z.string().min(1).nullable(),
  sourceUrl: z.url().nullable(),
  /** When the source last changed this element, if it says. */
  sourceUpdatedAt: z.iso.datetime({ offset: true }).nullable(),

  position: positionSchema,

  name: z.string().min(1).nullable(),
  operatorName: z.string().min(1).nullable(),

  /** Unparsed. TASK-013 owns the parsing. */
  openingHoursRaw: z.string().min(1).nullable(),

  priceState: z.enum(PRICE_STATES),
  chargeRaw: z.string().min(1).nullable(),
  /** Source tags as given, for example `{ "payment:cards": "yes" }`. */
  paymentMethodsRaw: z.record(z.string(), z.string()).nullable(),

  accessType: z.enum(ACCESS_TYPES),
  /** The source's own access value, kept so an `unknown` stays explainable. */
  accessRaw: z.string().min(1).nullable(),

  wheelchair: featureState,
  changingTable: featureState,
  male: featureState,
  female: featureState,
  unisex: featureState,

  level: z.string().min(1).nullable(),
  /** `null` means unknown. */
  indoor: z.boolean().nullable(),

  /** When the source itself last checked, if it says. Date only. */
  sourceVerifiedAt: z.iso.date().nullable(),

  /** Free text from the source. Never rendered without review. */
  notesRaw: z.string().min(1).nullable(),
});

export type NormalizedSourceRecord = z.infer<typeof normalizedSourceRecordSchema>;

/**
 * Parses adapter output. Throws with every issue listed, because a record that
 * fails here is a bug in the adapter, not bad source data, and the adapter
 * author needs the whole list at once.
 */
export function parseNormalizedSourceRecord(input: unknown): NormalizedSourceRecord {
  return normalizedSourceRecordSchema.parse(input);
}
