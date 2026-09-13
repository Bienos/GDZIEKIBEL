import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normalizeElement, OSM_SOURCE_NAME } from '@/lib/ingest/osm/normalize';
import { validateElement, type ValidElement } from '@/lib/ingest/osm/validate';
import { OVERPASS_AREA_OFFSET, stripUserFields, toiletsQuery } from '@/lib/ingest/osm/fetch';

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/osm/elements.json', import.meta.url)), 'utf8'),
) as { elements: unknown[] };

function validated(index: number): ValidElement {
  const result = validateElement(fixture.elements[index]);
  if (!result.ok) throw new Error(`fixture ${index} should be valid: ${result.reason}`);
  return result.element;
}

describe('validateElement', () => {
  it('accepts the four usable fixture elements and rejects the two broken ones', () => {
    const results = fixture.elements.map(validateElement);

    expect(results.filter((item) => item.ok)).toHaveLength(4);
    expect(results.filter((item) => !item.ok)).toHaveLength(2);
  });

  it('takes a way position from center', () => {
    const way = validated(2);

    expect(way.type).toBe('way');
    expect(way.position).toEqual({ lat: 52.235, lon: 21.005 });
  });

  it('rejects an element with no position, naming it without dumping it', () => {
    const result = validateElement(fixture.elements[4]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.key).toBe('node/5');
    expect(result.reason).toMatch(/position is missing/);
  });

  it('rejects a position outside Warsaw', () => {
    const result = validateElement(fixture.elements[5]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/outside the coarse Warsaw box/);
  });

  it('rejects malformed shapes', () => {
    expect(validateElement(null).ok).toBe(false);
    expect(validateElement({ type: 'node', id: 1 }).ok).toBe(false);
    expect(validateElement({ type: 'point', id: 1, version: 1, lat: 52.2, lon: 21 }).ok).toBe(
      false,
    );
    expect(
      validateElement({ type: 'node', id: 1, version: 1, lat: 52.2, lon: 21, tags: { a: 5 } }).ok,
    ).toBe(false);
  });

  it('rejects an oversized tag value', () => {
    const result = validateElement({
      type: 'node',
      id: 1,
      version: 1,
      lat: 52.2,
      lon: 21,
      tags: { note: 'x'.repeat(4097) },
    });

    expect(result.ok).toBe(false);
  });
});

describe('normalizeElement', () => {
  it('maps a fully tagged element', () => {
    const record = normalizeElement(validated(0));

    expect(record.sourceName).toBe(OSM_SOURCE_NAME);
    expect(record.sourceRecordId).toBe('node/1');
    expect(record.sourceVersion).toBe('3');
    expect(record.sourceUrl).toBe('https://www.openstreetmap.org/node/1');
    expect(record.name).toBe('Toaleta Plac Defilad');
    expect(record.operatorName).toBe('ZOM');
    expect(record.openingHoursRaw).toBe('Mo-Su 06:00-22:00');
    expect(record.priceState).toBe('free');
    expect(record.accessType).toBe('public_unconditional');
    expect(record.wheelchair).toBe('yes');
    expect(record.changingTable).toBe('limited');
    expect(record.unisex).toBe('yes');
    expect(record.level).toBe('-1');
    expect(record.indoor).toBe(true);
    expect(record.sourceVerifiedAt).toBe('2026-07-15');
    expect(record.paymentMethodsRaw).toEqual({ 'payment:cards': 'yes' });
    expect(record.notesRaw).toContain('Marszalkowskiej');
  });

  it('leaves an untagged element entirely unknown, never no or free', () => {
    const record = normalizeElement(validated(1));

    expect(record.priceState).toBe('unknown');
    expect(record.accessType).toBe('unknown');
    expect(record.wheelchair).toBe('unknown');
    expect(record.changingTable).toBe('unknown');
    expect(record.male).toBe('unknown');
    expect(record.female).toBe('unknown');
    expect(record.unisex).toBe('unknown');
    expect(record.indoor).toBeNull();
    expect(record.name).toBeNull();
    expect(record.openingHoursRaw).toBeNull();
    expect(record.sourceVerifiedAt).toBeNull();
  });

  it('distinguishes fee=no from an absent fee tag', () => {
    expect(normalizeElement(validated(0)).priceState).toBe('free');
    expect(normalizeElement(validated(1)).priceState).toBe('unknown');
    expect(normalizeElement(validated(2)).priceState).toBe('paid');
    expect(normalizeElement(validated(2)).chargeRaw).toBe('4.50 PLN');
  });

  it('maps access=customers to customers_only and keeps the raw value', () => {
    const record = normalizeElement(validated(3));

    expect(record.accessType).toBe('customers_only');
    expect(record.accessRaw).toBe('customers');
    expect(record.wheelchair).toBe('no');
  });

  it('falls back to unknown for an access value it does not recognise', () => {
    const record = normalizeElement({
      type: 'node',
      id: 9,
      version: 1,
      position: { lat: 52.2, lon: 21 },
      tags: { access: 'destination' },
      timestamp: null,
    });

    expect(record.accessType).toBe('unknown');
    expect(record.accessRaw).toBe('destination');
  });

  it('ignores a malformed check_date rather than storing a bad one', () => {
    const record = normalizeElement({
      type: 'node',
      id: 10,
      version: 1,
      position: { lat: 52.2, lon: 21 },
      tags: { check_date: 'summer 2026' },
      timestamp: null,
    });

    expect(record.sourceVerifiedAt).toBeNull();
  });
});

describe('overpass helpers', () => {
  it('strips the OSM account fields that are never persisted', () => {
    const stripped = stripUserFields({ id: 1, user: 'mapper', uid: 42, tags: {} }) as Record<
      string,
      unknown
    >;

    expect(stripped.user).toBeUndefined();
    expect(stripped.uid).toBeUndefined();
    expect(stripped.id).toBe(1);
  });

  it('builds an area query from the boundary relation id', () => {
    const query = toiletsQuery(336075);

    expect(query).toContain(`area(${OVERPASS_AREA_OFFSET + 336075})`);
    expect(query).toContain('node["amenity"="toilets"](area.warsaw)');
    expect(query).toContain('out center meta');
  });
});
