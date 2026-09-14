import { describe, expect, it } from 'vitest';
import { scrubSensitiveText } from '@/lib/observability/scrub-sensitive-text';

describe('scrubSensitiveText', () => {
  it('redacts a comma-separated decimal coordinate pair', () => {
    expect(scrubSensitiveText('failed near 52.2297,21.0122')).toBe(
      'failed near [REDACTED_COORDINATES]',
    );
  });

  it('redacts a coordinate pair with a space after the comma', () => {
    expect(scrubSensitiveText('at 52.2297, 21.0122 today')).toBe('at [REDACTED_COORDINATES] today');
  });

  it('redacts a lat/lng-keyed value regardless of spelling', () => {
    expect(scrubSensitiveText('lat=52.2297')).toBe('[REDACTED_COORDINATES]');
    expect(scrubSensitiveText('"lng":21.0122')).toBe('"[REDACTED_COORDINATES]');
    expect(scrubSensitiveText('longitude: 21.0122')).toBe('[REDACTED_COORDINATES]');
    expect(scrubSensitiveText('latitude=52.2297')).toBe('[REDACTED_COORDINATES]');
  });

  it('redacts both keyed fields in one JSON-shaped string', () => {
    expect(scrubSensitiveText('{"lat":52.2297,"lng":21.0122}')).toBe(
      '{"[REDACTED_COORDINATES],"[REDACTED_COORDINATES]}',
    );
  });

  it('never redacts a bare decimal that is not part of a coordinate pair', () => {
    expect(scrubSensitiveText('charged 4.50 PLN, walked 240.5 m')).toBe(
      'charged 4.50 PLN, walked 240.5 m',
    );
  });

  it('leaves plain text with no coordinate-shaped content untouched', () => {
    expect(scrubSensitiveText('connection refused')).toBe('connection refused');
  });
});
