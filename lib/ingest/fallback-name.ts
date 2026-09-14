/**
 * The label used when a source gives no name. It states nothing about
 * access, price or hours. Revisit when copy rules for labels exist.
 *
 * Kept in its own module, not `upsert.ts`, so `lib/ingest/dedup.ts`
 * (TASK-022) can import it without a circular dependency: `upsert.ts`
 * itself imports the matching logic from `dedup.ts`.
 */
export const FALLBACK_TOILET_NAME = 'Toaleta';
