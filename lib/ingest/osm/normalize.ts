import { deriveOpeningHours } from '@/lib/opening-hours/parse-opening-hours';
import {
  parseNormalizedSourceRecord,
  type NormalizedSourceRecord,
} from '@/lib/toilets/normalized-source-record';
import type { AccessType, FeatureState, PriceState } from '@/lib/toilets/types';
import type { ValidElement } from './validate';

/**
 * Maps a validated OSM element to the normalised record the database accepts.
 * Implements `docs/contracts/osm-toilets-source.md` section 6, tag for tag.
 *
 * The rule throughout: an absent tag is `unknown` or `null`. Nothing here
 * turns absence into `no`, `free`, `false` or `open`. An unexpected tag value
 * is also `unknown`, with the raw value kept where the contract asks for it,
 * so the outcome stays explainable.
 */

export const OSM_SOURCE_NAME = 'osm';

function featureState(value: string | undefined): FeatureState {
  switch (value) {
    case 'yes':
      return 'yes';
    case 'no':
      return 'no';
    case 'limited':
      return 'limited';
    default:
      return 'unknown';
  }
}

function priceState(fee: string | undefined): PriceState {
  if (fee === 'yes') return 'paid';
  if (fee === 'no') return 'free';
  return 'unknown';
}

/**
 * The contract's access mapping. `permissive` is treated as public because
 * the tag means the owner tolerates public use; the raw value is kept so
 * TASK-019 can lower confidence for it.
 */
function accessType(access: string | undefined): AccessType {
  switch (access) {
    case undefined:
      return 'unknown';
    case 'yes':
    case 'public':
    case 'permissive':
      return 'public_unconditional';
    case 'customers':
      return 'customers_only';
    case 'private':
    case 'no':
      return 'not_public';
    default:
      return 'unknown';
  }
}

function nonEmpty(value: string | undefined): string | null {
  return value !== undefined && value.trim() !== '' ? value : null;
}

/** Accepts only a full YYYY-MM-DD date. Anything else is not a date we trust. */
function isoDate(value: string | undefined): string | null {
  return value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function paymentTags(tags: Record<string, string>): Record<string, string> | null {
  const entries = Object.entries(tags).filter(([key]) => key.startsWith('payment:'));
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function indoor(value: string | undefined): boolean | null {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return null;
}

export function normalizeElement(element: ValidElement): NormalizedSourceRecord {
  const { tags } = element;
  const notes = [nonEmpty(tags.description), nonEmpty(tags.note)].filter(
    (item): item is string => item !== null,
  );

  const openingHoursRaw = nonEmpty(tags.opening_hours);

  const candidate = {
    sourceName: OSM_SOURCE_NAME,
    sourceRecordId: `${element.type}/${element.id}`,
    sourceVersion: String(element.version),
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    sourceUpdatedAt: element.timestamp,

    position: element.position,

    name: nonEmpty(tags.name),
    operatorName: nonEmpty(tags.operator),

    openingHoursRaw,
    ...deriveOpeningHours(openingHoursRaw),

    priceState: priceState(tags.fee),
    chargeRaw: nonEmpty(tags.charge),
    paymentMethodsRaw: paymentTags(tags),

    accessType: accessType(tags.access),
    accessRaw: nonEmpty(tags.access),

    wheelchair: featureState(tags.wheelchair),
    changingTable: featureState(tags.changing_table),
    male: featureState(tags.male),
    female: featureState(tags.female),
    unisex: featureState(tags.unisex),

    level: nonEmpty(tags.level),
    indoor: indoor(tags.indoor),

    sourceVerifiedAt: isoDate(tags.check_date) ?? isoDate(tags['survey:date']),

    notesRaw: notes.length > 0 ? notes.join('\n') : null,
  };

  // Our own output is validated against the contract schema. A failure here is
  // a bug in this mapping, not bad source data, and should surface loudly.
  return parseNormalizedSourceRecord(candidate);
}
