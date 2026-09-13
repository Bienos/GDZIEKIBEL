/**
 * TASK-004 command: ingest Warsaw toilets from OpenStreetMap.
 *
 * Usage:
 *   pnpm ingest:osm                       fetch from Overpass and upsert
 *   pnpm ingest:osm -- --from-file <path> replay a saved raw response
 *   pnpm ingest:osm -- --dry-run          fetch and report, write nothing
 *
 * The whole upsert is one transaction. A failure leaves the tables as they
 * were and records a failed ingestion run.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config as loadEnvFile } from 'dotenv';
import { closePool, getPool } from '../../db/client';
import {
  fetchToiletsInBoundary,
  resolveBoundaryCandidates,
  type BoundaryCandidate,
} from '../../lib/ingest/osm/fetch';
import { normalizeElement } from '../../lib/ingest/osm/normalize';
import { OSM_SOURCE_NAME } from '../../lib/ingest/osm/normalize';
import { validateElement } from '../../lib/ingest/osm/validate';
import { upsertSourceRecords } from '../../lib/ingest/upsert';
import type { NormalizedSourceRecord } from '../../lib/toilets/normalized-source-record';

loadEnvFile({ path: '.env.local', quiet: true });
loadEnvFile({ quiet: true });

const OUTPUT_DIR = process.env.INGEST_OUTPUT_DIR ?? '.ingest-output';

function flagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const fromFile = flagValue('--from-file');
const dryRun = process.argv.includes('--dry-run');

function out(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Picks the boundary relation, or refuses when the answer is not singular. */
function chooseBoundary(candidates: BoundaryCandidate[]): BoundaryCandidate {
  if (candidates.length === 0) {
    throw new Error(
      'No Warsaw administrative boundary relation matched. The query or the data changed; ' +
        'do not guess a relation id.',
    );
  }
  // The city proper is admin_level 6 in Poland; anything else needs a person.
  const cityLevel = candidates.filter((item) => item.adminLevel === '6');
  if (cityLevel.length === 1 && cityLevel[0]) return cityLevel[0];

  throw new Error(
    `Expected exactly one admin_level 6 boundary, found ${cityLevel.length}. Candidates: ` +
      candidates.map((item) => `${item.id} (${item.name}, level ${item.adminLevel})`).join('; '),
  );
}

async function loadElements(): Promise<{ elements: unknown[]; boundary: string }> {
  if (fromFile) {
    const raw = await readFile(fromFile, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    const elements =
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray((parsed as { elements?: unknown }).elements)
        ? (parsed as { elements: unknown[] }).elements
        : [];
    out(`Replaying ${elements.length} elements from ${fromFile}`);
    return { elements, boundary: `file:${fromFile}` };
  }

  out('Resolving the Warsaw administrative boundary');
  const { candidates, body } = await resolveBoundaryCandidates();
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(join(OUTPUT_DIR, 'boundary.json'), body, 'utf8');
  for (const candidate of candidates) {
    out(
      `  candidate: relation ${candidate.id}, ${candidate.name}, admin_level ${candidate.adminLevel}`,
    );
  }

  const boundary = chooseBoundary(candidates);
  out(`  using relation ${boundary.id} (${boundary.name}, admin_level ${boundary.adminLevel})`);

  out('Fetching toilets');
  const response = await fetchToiletsInBoundary(boundary.id);
  await writeFile(join(OUTPUT_DIR, 'toilets.json'), response.body, 'utf8');
  out(`  ${response.elements.length} elements, raw response saved`);

  return {
    elements: response.elements,
    boundary: `relation ${boundary.id} (${boundary.name}, admin_level ${boundary.adminLevel})`,
  };
}

async function main(): Promise<void> {
  const runStartedAt = new Date();
  const { elements, boundary } = await loadElements();

  const records: NormalizedSourceRecord[] = [];
  const rejections: { key: string; reason: string }[] = [];
  // Raw hours existed but did not fit the bounded grammar
  // (lib/opening-hours/parse-opening-hours.ts): not a rejected element, its
  // opening status is just UNKNOWN. ARCHITECTURE.md section 10: "do not
  // silently discard malformed hours; record ingestion warnings."
  const unparsedHours: { key: string; raw: string }[] = [];

  for (const element of elements) {
    const result = validateElement(element);
    if (!result.ok) {
      rejections.push({ key: result.key, reason: result.reason });
      continue;
    }
    const record = normalizeElement(result.element);
    records.push(record);
    if (
      record.openingHoursRaw !== null &&
      !record.open24h &&
      record.openingHoursNormalized === null
    ) {
      unparsedHours.push({ key: record.sourceRecordId, raw: record.openingHoursRaw });
    }
  }

  out('');
  out(`Validated ${records.length}, rejected ${rejections.length}`);
  for (const rejection of rejections.slice(0, 20)) {
    // Key and reason only. The raw element is never logged.
    out(`  rejected ${rejection.key}: ${rejection.reason}`);
  }
  if (rejections.length > 20) out(`  ... and ${rejections.length - 20} more`);

  out(`Opening hours: ${unparsedHours.length} unparsed, kept as UNKNOWN status`);
  for (const item of unparsedHours.slice(0, 20)) {
    out(`  unparsed ${item.key}: "${item.raw}"`);
  }
  if (unparsedHours.length > 20) out(`  ... and ${unparsedHours.length - 20} more`);

  if (dryRun) {
    out('\nDry run: nothing written.');
    return;
  }

  const client = await getPool().connect();
  let runId: string | undefined;
  try {
    const run = await client.query<{ id: string }>(
      `INSERT INTO ingestion_runs (source_name, started_at) VALUES ($1, $2) RETURNING id`,
      [OSM_SOURCE_NAME, runStartedAt],
    );
    runId = run.rows[0]?.id;

    await client.query('BEGIN');
    const counts = await upsertSourceRecords(client, OSM_SOURCE_NAME, records, runStartedAt);
    await client.query(
      `UPDATE ingestion_runs SET
         status = 'succeeded', finished_at = now(),
         records_fetched = $2, records_created = $3, records_updated = $4,
         records_unchanged = $5, records_rejected = $6
       WHERE id = $1`,
      [runId, counts.fetched, counts.created, counts.updated, counts.unchanged, rejections.length],
    );
    await client.query('COMMIT');

    out('');
    out(`Boundary:  ${boundary}`);
    out(`Fetched:   ${counts.fetched}`);
    out(`Created:   ${counts.created}`);
    out(`Updated:   ${counts.updated}`);
    out(`Unchanged: ${counts.unchanged}`);
    out(`Rejected:  ${rejections.length}`);
    out(`Not seen:  ${counts.notSeen}`);
  } catch (error) {
    await client.query('ROLLBACK');
    if (runId) {
      await client.query(
        `UPDATE ingestion_runs SET status = 'failed', finished_at = now(), error_summary = $2
          WHERE id = $1`,
        [runId, (error as Error).message.slice(0, 500)],
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

main()
  .then(async () => {
    await closePool();
  })
  .catch(async (error: unknown) => {
    process.exitCode = 1;
    process.stderr.write(
      `ingest failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    await closePool();
  });
