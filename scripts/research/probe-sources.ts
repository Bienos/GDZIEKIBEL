/**
 * TASK-002 one-off probe. Not application code.
 *
 * Reads the candidate Warsaw and OpenStreetMap sources and records what they
 * actually return, so the TASK-002 verification rests on observation rather
 * than recall. It answers nothing by itself: it saves raw responses and writes
 * a report in which anything not observed stays marked UNVERIFIED.
 *
 * Usage:
 *   pnpm research:probe            counts and dataset metadata only
 *   pnpm research:probe -- --full  also downloads Warsaw toilet elements and
 *                                  computes tag coverage
 *
 * Requires outbound access to api.um.warszawa.pl, dane.um.warszawa.pl and
 * overpass-api.de. Sandboxed agent environments commonly deny all three; the
 * report then records the denial, which is a blocker, not a result.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CatalogueDataset, DatastoreSample, TagCoverage } from './parse';
import { readCatalogue, readDatastore, readOverpassCount, readTagCoverage } from './parse';

const OUTPUT_DIR = process.env.RESEARCH_OUTPUT_DIR ?? '.research-output';
const FULL = process.argv.includes('--full');

/**
 * Identifies the client to the operators whose services this queries, as their
 * usage policies expect.
 */
const USER_AGENT =
  'GdzieKibel.pl TASK-002 source probe (one-off research; https://github.com/Bienos/GDZIEKIBEL)';

/**
 * Approximate bounding box around the Warsaw administrative area.
 *
 * This is a probe convenience, not the project's area definition. TASK-002 must
 * record whichever area it finally uses, and an administrative boundary is
 * likely the better choice for ingestion.
 */
const WARSAW_BBOX = { south: 52.0979, west: 20.8512, north: 52.3679, east: 21.2711 };
const BBOX = `${WARSAW_BBOX.south},${WARSAW_BBOX.west},${WARSAW_BBOX.north},${WARSAW_BBOX.east}`;

/** Search terms for the city dataset catalogue. */
const CATALOGUE_TERMS = ['toaleta', 'toalety', 'szalet', 'WC'];

/** Candidate catalogue hosts. Which one is current is for TASK-002 to record. */
const CATALOGUE_HOSTS = ['https://api.um.warszawa.pl', 'https://dane.um.warszawa.pl'];

/** CKAN exposes both paths depending on version, so try both. */
const CKAN_PATHS = ['/api/3/action/package_search', '/api/action/package_search'];

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

/** CKAN datastore_search paths, tried in order for each resource id. */
const DATASTORE_PATHS = ['/api/3/action/datastore_search', '/api/action/datastore_search'];

/** Upper bound on datastore_search calls per run, to stay polite to the catalogue. */
const MAX_DATASTORE_SAMPLES = 10;

/**
 * Catalogue and datastore calls should answer in seconds. Overpass may
 * legitimately take minutes, and its own query timeout is set to match.
 */
const CATALOGUE_TIMEOUT_MS = 30_000;
const OVERPASS_TIMEOUT_MS = 180_000;

interface Probe {
  label: string;
  url: string;
  observedAt: string;
  ok: boolean;
  status: number | null;
  contentType: string | null;
  bytes: number | null;
  savedAs: string | null;
  error: string | null;
}

interface SchemaSample {
  dataset: CatalogueDataset;
  resourceId: string;
  sample: DatastoreSample | null;
}

const probes: Probe[] = [];

function slug(label: string): string {
  return label
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/** Fetches a URL, saves the raw body, and records the outcome either way. */
async function probe(
  label: string,
  url: string,
  body?: string,
  timeoutMs: number = CATALOGUE_TIMEOUT_MS,
): Promise<string | null> {
  const observedAt = new Date().toISOString();
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
  if (body !== undefined) headers['Content-Type'] = 'application/x-www-form-urlencoded';

  try {
    const response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    const savedAs = `${slug(label)}.txt`;
    await writeFile(join(OUTPUT_DIR, savedAs), text, 'utf8');

    probes.push({
      label,
      url,
      observedAt,
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type'),
      bytes: Buffer.byteLength(text),
      savedAs,
      error: null,
    });
    process.stdout.write(`  ${response.ok ? 'ok  ' : 'FAIL'} ${response.status} ${label}\n`);
    return response.ok ? text : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    probes.push({
      label,
      url,
      observedAt,
      ok: false,
      status: null,
      contentType: null,
      bytes: null,
      savedAs: null,
      error: message,
    });
    process.stdout.write(`  FAIL ---  ${label}: ${message}\n`);
    return null;
  }
}

const OVERPASS_TOILETS_COUNT = `[out:json][timeout:180];
(
  node["amenity"="toilets"](${BBOX});
  way["amenity"="toilets"](${BBOX});
  relation["amenity"="toilets"](${BBOX});
);
out count;`;

const OVERPASS_VENUE_TOILETS_COUNT = `[out:json][timeout:180];
(
  node["toilets"](${BBOX});
  way["toilets"](${BBOX});
);
out count;`;

const OVERPASS_TOILETS_FULL = `[out:json][timeout:180];
(
  node["amenity"="toilets"](${BBOX});
  way["amenity"="toilets"](${BBOX});
  relation["amenity"="toilets"](${BBOX});
);
out tags;`;

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const startedAt = new Date().toISOString();

  process.stdout.write('Warsaw dataset catalogue\n');
  const datasets: CatalogueDataset[] = [];
  for (const host of CATALOGUE_HOSTS) {
    for (const path of CKAN_PATHS) {
      for (const term of CATALOGUE_TERMS) {
        const url = `${host}${path}?q=${encodeURIComponent(term)}&rows=50`;
        const raw = await probe(`catalogue ${host} ${path} ${term}`, url);
        if (raw) datasets.push(...readCatalogue(term, host, raw));
      }
    }
  }

  const unique = new Map<string, CatalogueDataset>();
  for (const dataset of datasets) {
    const key = `${dataset.host}:${dataset.id ?? dataset.name ?? dataset.title ?? ''}`;
    if (!unique.has(key)) unique.set(key, dataset);
  }

  // One datastore_search per resource, limit=1, is what reveals the field list,
  // the record count and a real example record. The catalogue alone shows none
  // of those, and TASK-002 requires all three to be observed, not recalled.
  process.stdout.write('\nWarsaw dataset schema (datastore_search, limit=1)\n');
  const samples: SchemaSample[] = [];
  for (const dataset of unique.values()) {
    for (const resource of dataset.resources) {
      if (!resource.id || samples.length >= MAX_DATASTORE_SAMPLES) continue;
      let sample: DatastoreSample | null = null;
      for (const path of DATASTORE_PATHS) {
        const query = `resource_id=${encodeURIComponent(resource.id)}&limit=1`;
        const raw = await probe(
          `datastore ${dataset.host} ${path} ${resource.id}`,
          `${dataset.host}${path}?${query}`,
        );
        sample = raw ? readDatastore(raw) : null;
        if (sample) break;
      }
      samples.push({ dataset, resourceId: resource.id, sample });
    }
  }
  if (samples.length === 0) {
    process.stdout.write('  (no catalogue resource carried a datastore id)\n');
  }

  process.stdout.write('\nOpenStreetMap via Overpass\n');
  const toiletsRaw = await probe(
    'overpass amenity toilets count',
    OVERPASS_ENDPOINT,
    `data=${encodeURIComponent(OVERPASS_TOILETS_COUNT)}`,
    OVERPASS_TIMEOUT_MS,
  );
  const venueRaw = await probe(
    'overpass venue toilets count',
    OVERPASS_ENDPOINT,
    `data=${encodeURIComponent(OVERPASS_VENUE_TOILETS_COUNT)}`,
    OVERPASS_TIMEOUT_MS,
  );

  let coverage: TagCoverage | null = null;
  if (FULL) {
    const fullRaw = await probe(
      'overpass amenity toilets tags',
      OVERPASS_ENDPOINT,
      `data=${encodeURIComponent(OVERPASS_TOILETS_FULL)}`,
      OVERPASS_TIMEOUT_MS,
    );
    if (fullRaw) coverage = readTagCoverage(fullRaw);
  }

  const toiletsCount = toiletsRaw ? readOverpassCount(toiletsRaw) : null;
  const venueCount = venueRaw ? readOverpassCount(venueRaw) : null;

  const lines: string[] = [
    '# TASK-002 source probe — raw observations',
    '',
    'Generated by `scripts/research/probe-sources.ts`. Machine output, not a decision.',
    'Anything this run did not observe is marked UNVERIFIED and must stay that way',
    'until someone observes it.',
    '',
    `- Run started: ${startedAt}`,
    `- Mode: ${FULL ? 'full (counts + tag coverage)' : 'counts and catalogue metadata only'}`,
    `- Warsaw bbox used: ${BBOX} (approximate; not the project area definition)`,
    '',
    '## Requests made',
    '',
    '| Result | Status | Label | URL | Saved |',
    '| --- | --- | --- | --- | --- |',
    ...probes.map(
      (item) =>
        `| ${item.ok ? 'ok' : 'failed'} | ${item.status ?? (item.error ? 'error' : '-')} | ${item.label} | ${item.url} | ${item.savedAs ?? '-'} |`,
    ),
    '',
  ];

  const failures = probes.filter((item) => !item.ok);
  if (failures.length > 0) {
    lines.push('### Failures', '');
    for (const item of failures) {
      lines.push(`- ${item.label}: ${item.error ?? `HTTP ${item.status ?? 'unknown'}`}`);
    }
    lines.push('');
  }

  lines.push('## Warsaw dataset catalogue', '');
  if (unique.size === 0) {
    lines.push(
      'UNVERIFIED. No catalogue response was parsed, so no dataset identifier,',
      'schema, cadence or licence has been observed.',
      '',
    );
  } else {
    lines.push('| Host | id | name | title | license_id | license_title | modified |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const dataset of unique.values()) {
      lines.push(
        `| ${dataset.host} | ${dataset.id ?? '-'} | ${dataset.name ?? '-'} | ${dataset.title ?? '-'} | ${dataset.licenseId ?? 'UNVERIFIED'} | ${dataset.licenseTitle ?? 'UNVERIFIED'} | ${dataset.metadataModified ?? '-'} |`,
      );
    }
    lines.push('', '### Resources', '');
    for (const dataset of unique.values()) {
      lines.push(`- ${dataset.title ?? dataset.name ?? dataset.id ?? 'unnamed'}`);
      for (const resource of dataset.resources) {
        lines.push(`  - ${resource.format ?? 'unknown format'}: ${resource.url ?? '-'}`);
      }
    }
    lines.push('');
  }

  lines.push('### Schema samples (datastore_search, limit=1)', '');
  if (samples.length === 0) {
    lines.push(
      'UNVERIFIED. No catalogue resource carried a datastore id, so no field list,',
      'record count or example record has been observed.',
      '',
    );
  }
  for (const { dataset, resourceId, sample } of samples) {
    const name = dataset.title ?? dataset.name ?? dataset.id ?? 'unnamed';
    lines.push(`#### ${name} — resource ${resourceId}`, '');
    if (!sample) {
      lines.push('UNVERIFIED. datastore_search returned nothing parseable for this resource.', '');
      continue;
    }
    lines.push(
      `- total records: ${sample.total ?? 'UNVERIFIED'}`,
      `- fields observed: ${sample.fields.length}`,
      '',
      '| Field | Type |',
      '| --- | --- |',
    );
    for (const field of sample.fields) lines.push(`| ${field.id} | ${field.type ?? '-'} |`);
    lines.push('');
    if (sample.example) {
      lines.push('Example record, first row returned:', '', '```json');
      lines.push(JSON.stringify(sample.example, null, 2), '```', '');
    } else {
      lines.push('Example record: UNVERIFIED. The response carried no records.', '');
    }
  }

  lines.push(
    '## OpenStreetMap counts',
    '',
    `- \`amenity=toilets\` in bbox: ${toiletsCount ?? 'UNVERIFIED'}`,
    `- venues tagged \`toilets=*\` in bbox: ${venueCount ?? 'UNVERIFIED'}`,
    '',
    'Query used for the first count:',
    '',
    '```',
    OVERPASS_TOILETS_COUNT,
    '```',
    '',
  );

  if (coverage) {
    lines.push('## OpenStreetMap tag coverage', '', `Elements examined: ${coverage.total}`, '');
    lines.push('| Tag | Present | Share |', '| --- | --- | --- |');
    for (const [key, value] of Object.entries(coverage.counts)) {
      const share = coverage.total > 0 ? `${((value / coverage.total) * 100).toFixed(1)}%` : '-';
      lines.push(`| ${key} | ${value} | ${share} |`);
    }
    lines.push('', 'A tag that is absent means unknown. It does not mean no.', '');
  } else if (FULL) {
    lines.push(
      '## OpenStreetMap tag coverage',
      '',
      'UNVERIFIED. The full query did not return.',
      '',
    );
  }

  lines.push(
    '## Still unverified after this run',
    '',
    'This probe cannot observe these. TASK-002 requires them from the published',
    'terms and documentation, read by a person:',
    '',
    '- reuse terms for the Warsaw dataset, quoted, with a link to the terms;',
    '- stated refresh cadence;',
    '- whether removed facilities are represented, and how;',
    '- whether operational status is exposed separately from opening hours;',
    '- documented rate limits;',
    '- whether the OpenStreetMap share-alike obligation reaches the product database.',
    '',
  );

  const reportPath = join(OUTPUT_DIR, 'OBSERVATIONS.md');
  await writeFile(reportPath, lines.join('\n'), 'utf8');

  // Machine-readable record of every request, including the per-request
  // timestamp and content type. TASK-002 has to cite when each value was
  // observed, and an HTML content type is how a rate-limit page gives itself
  // away when the body looked like it parsed.
  await writeFile(
    join(OUTPUT_DIR, 'probes.json'),
    JSON.stringify({ startedAt, mode: FULL ? 'full' : 'counts', bbox: BBOX, probes }, null, 2),
    'utf8',
  );

  process.stdout.write(`\nWrote ${reportPath}\n`);
  process.stdout.write(`Raw responses in ${OUTPUT_DIR}/\n`);

  if (failures.length === probes.length) {
    process.stdout.write('\nEvery request failed. This is a blocker, not a result.\n');
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.exitCode = 1;
  process.stderr.write(`probe failed: ${error instanceof Error ? error.message : String(error)}\n`);
});
