/**
 * Pure readers for the TASK-002 source probe.
 *
 * Kept apart from the probe script so they can be tested without network
 * access, and so importing them runs nothing.
 *
 * Every reader returns null rather than a plausible-looking value when the
 * input does not contain what it is looking for. A probe that guesses is worse
 * than a probe that reports nothing.
 */

export interface CatalogueResource {
  /** CKAN resource id, needed to query the datastore for schema and records. */
  id: string | null;
  format: string | null;
  url: string | null;
}

export interface CatalogueDataset {
  term: string;
  host: string;
  id: string | null;
  name: string | null;
  title: string | null;
  licenseId: string | null;
  licenseTitle: string | null;
  metadataModified: string | null;
  resources: CatalogueResource[];
}

export interface DatastoreField {
  id: string;
  type: string | null;
}

/** What one `datastore_search` call with `limit=1` reveals about a resource. */
export interface DatastoreSample {
  fields: DatastoreField[];
  /** Total record count as reported by the datastore, or null when absent. */
  total: number | null;
  /** The first record returned, or null when the response carried none. */
  example: Record<string, unknown> | null;
}

export interface TagCoverage {
  total: number;
  counts: Record<string, number>;
}

/** Tags whose presence decides whether a record is usable to the product. */
export const COVERAGE_TAGS = [
  'opening_hours',
  'fee',
  'access',
  'wheelchair',
  'changing_table',
  'operator',
  'name',
  'level',
  'charge',
  'payment:cards',
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Accepts a number, or a string that is only digits. Anything else is null. */
function asCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Pulls the licence-relevant fields out of a CKAN package_search response. */
export function readCatalogue(term: string, host: string, raw: string): CatalogueDataset[] {
  const result = asRecord(asRecord(parseJson(raw))?.result);
  const packages = result?.results;
  if (!Array.isArray(packages)) return [];

  return packages.flatMap((entry) => {
    const pkg = asRecord(entry);
    if (!pkg) return [];

    const resourceList = Array.isArray(pkg.resources) ? pkg.resources : [];
    return [
      {
        term,
        host,
        id: asString(pkg.id),
        name: asString(pkg.name),
        title: asString(pkg.title),
        licenseId: asString(pkg.license_id),
        licenseTitle: asString(pkg.license_title),
        metadataModified: asString(pkg.metadata_modified),
        resources: resourceList.flatMap((item) => {
          const resource = asRecord(item);
          if (!resource) return [];
          return [
            {
              id: asString(resource.id),
              format: asString(resource.format),
              url: asString(resource.url),
            },
          ];
        }),
      },
    ];
  });
}

/**
 * Reads the field list, total and first record out of a CKAN datastore_search
 * response. Returns null when there is no field list, because without one the
 * response is not a datastore result at all, whatever else it contains.
 */
export function readDatastore(raw: string): DatastoreSample | null {
  const result = asRecord(asRecord(parseJson(raw))?.result);
  if (!result || !Array.isArray(result.fields)) return null;

  const fields = result.fields.flatMap((item) => {
    const field = asRecord(item);
    const id = asString(field?.id);
    if (!id) return [];
    return [{ id, type: asString(field?.type) }];
  });

  const records = Array.isArray(result.records) ? result.records : [];

  return {
    fields,
    total: asCount(result.total),
    example: asRecord(records[0]),
  };
}

/** Reads the element total out of an Overpass `out count` response. */
export function readOverpassCount(raw: string): string | null {
  const elements = asRecord(parseJson(raw))?.elements;
  if (!Array.isArray(elements) || elements.length === 0) return null;
  return asString(asRecord(asRecord(elements[0])?.tags)?.total);
}

/** Counts how many returned elements carry each coverage tag. */
export function readTagCoverage(raw: string): TagCoverage | null {
  const elements = asRecord(parseJson(raw))?.elements;
  if (!Array.isArray(elements)) return null;

  const counts: Record<string, number> = {};
  for (const key of COVERAGE_TAGS) counts[key] = 0;

  for (const element of elements) {
    const tags = asRecord(asRecord(element)?.tags);
    if (!tags) continue;
    for (const key of COVERAGE_TAGS) {
      if (tags[key] !== undefined) counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return { total: elements.length, counts };
}
