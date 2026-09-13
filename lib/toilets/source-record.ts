import { z } from 'zod';

/**
 * Executable form of the source-record contract in
 * `docs/contracts/toilet-sources.md` section 1.
 *
 * Every ingestion adapter (TASK-004) emits records in this shape, and the
 * `validate` step of the adapter pipeline (ARCHITECTURE.md 13) is this schema.
 *
 * Rules the schema enforces:
 * - unknown is `null`; an omitted nullable field parses to `null`, never to
 *   `false`, `0`, `''` or `'unknown'`;
 * - boolean-like fields accept booleans only (no `'yes'`/`'no'` strings);
 * - enumerated fields accept the contract's values only;
 * - a record without a `source_url` a person can open is invalid;
 * - positions are WGS84 and bounded;
 * - unknown keys are rejected, so a mis-spelled field cannot vanish silently.
 *
 * This module imports nothing from `db/`, `app/` or Next.js.
 */

export const SOURCE_NAMES = ['osm', 'metro-rule', 'hub-curated', 'warsaw-city'] as const;
export const POSITION_KINDS = ['point', 'centroid', 'station'] as const;
export const ACCESS_VALUES = ['public', 'customers', 'permissive', 'private', 'no'] as const;
export const FEE_VALUES = ['free', 'paid'] as const;
export const WHEELCHAIR_VALUES = ['yes', 'no', 'limited', 'designated'] as const;
export const CHANGING_TABLE_VALUES = ['yes', 'no', 'limited'] as const;
export const UNISEX_VALUES = ['yes', 'no'] as const;
export const OPENING_HOURS_FORMATS = ['osm', 'text'] as const;
export const LICENCES = ['ODbL-1.0', 'curated-fact'] as const;
export const ATTRIBUTIONS = ['OpenStreetMap'] as const;

/** A field whose absence means unknown: optional on input, `null` on output. */
function unknownAsNull<T extends z.ZodType>(schema: T) {
  return schema.nullable().default(null);
}

const nullableText = unknownAsNull(z.string().min(1));
const nullableBoolean = unknownAsNull(z.boolean());

const positionSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const addressSchema = z.strictObject({
  street: nullableText,
  housenumber: nullableText,
  city: nullableText,
  postcode: nullableText,
});

const priceSchema = z.strictObject({
  amount_minor: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/, 'currency must be a three-letter ISO 4217 code'),
});

const paymentSchema = z.strictObject({
  cash: nullableBoolean,
  cards: nullableBoolean,
  coins: nullableBoolean,
  contactless: nullableBoolean,
});

export const sourceToiletRecordSchema = z.strictObject({
  source_name: z.enum(SOURCE_NAMES),
  source_record_id: z.string().min(1),
  source_url: z.url({ protocol: /^https?$/ }),
  source_updated_at: unknownAsNull(z.iso.datetime({ offset: true })),
  fetched_at: z.iso.datetime({ offset: true }),
  position: positionSchema,
  position_kind: z.enum(POSITION_KINDS),
  name: nullableText,
  operator: nullableText,
  address: unknownAsNull(addressSchema),
  access: unknownAsNull(z.enum(ACCESS_VALUES)),
  fee: unknownAsNull(z.enum(FEE_VALUES)),
  price: unknownAsNull(priceSchema),
  payment: unknownAsNull(paymentSchema),
  opening_hours_raw: nullableText,
  opening_hours_format: unknownAsNull(z.enum(OPENING_HOURS_FORMATS)),
  wheelchair: unknownAsNull(z.enum(WHEELCHAIR_VALUES)),
  changing_table: unknownAsNull(z.enum(CHANGING_TABLE_VALUES)),
  unisex: unknownAsNull(z.enum(UNISEX_VALUES)),
  level: nullableText,
  indoor: nullableBoolean,
  portable: nullableBoolean,
  description: nullableText,
  raw_payload: z.record(z.string(), z.unknown()),
  licence: z.enum(LICENCES),
  attribution: unknownAsNull(z.enum(ATTRIBUTIONS)),
});

export type SourceToiletRecord = z.infer<typeof sourceToiletRecordSchema>;
export type SourceToiletRecordInput = z.input<typeof sourceToiletRecordSchema>;

/**
 * Parses one source record, throwing on the first invalid record.
 *
 * The error names the offending field paths and reasons only. It never echoes
 * the supplied values: a raw payload can be large, and a curated row could in
 * principle contain something that must not reach a log.
 */
export function parseSourceToiletRecord(input: unknown): SourceToiletRecord {
  const result = sourceToiletRecordSchema.safeParse(input);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid source toilet record: ${problems}`);
  }

  return result.data;
}
