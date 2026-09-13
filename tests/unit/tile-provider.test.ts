import { describe, expect, it } from 'vitest';
import { buildMapStyleUrl } from '@/lib/map/tile-provider';

describe('buildMapStyleUrl', () => {
  it('builds a MapTiler style URL from a key', () => {
    const url = buildMapStyleUrl('test-key-123');

    expect(url).toBe('https://api.maptiler.com/maps/dataviz-dark/style.json?key=test-key-123');
  });

  it('url-encodes a key with special characters', () => {
    const url = buildMapStyleUrl('has space/slash');

    expect(url).toContain(encodeURIComponent('has space/slash'));
  });

  it('returns null rather than a broken URL for an absent key', () => {
    expect(buildMapStyleUrl(undefined)).toBeNull();
  });

  it('returns null for an empty or whitespace-only key', () => {
    expect(buildMapStyleUrl('')).toBeNull();
    expect(buildMapStyleUrl('   ')).toBeNull();
  });

  it('trims surrounding whitespace from an otherwise valid key', () => {
    expect(buildMapStyleUrl('  abc123  ')).toBe(
      'https://api.maptiler.com/maps/dataviz-dark/style.json?key=abc123',
    );
  });
});
