import { describe, expect, it } from 'vitest';
import {
  extractClientIp,
  hashClientKey,
  rateLimitRetentionCutoff,
  rateLimitWindowStart,
  secondsUntilWindowEnds,
} from '@/lib/reports/rate-limit';

describe('rateLimitWindowStart', () => {
  it('floors to the containing hour boundary', () => {
    expect(rateLimitWindowStart(new Date('2026-09-14T10:37:12Z'))).toEqual(
      new Date('2026-09-14T10:00:00Z'),
    );
  });

  it('leaves an exact hour boundary unchanged', () => {
    expect(rateLimitWindowStart(new Date('2026-09-14T10:00:00Z'))).toEqual(
      new Date('2026-09-14T10:00:00Z'),
    );
  });
});

describe('rateLimitRetentionCutoff', () => {
  it('is 24 hours before now', () => {
    expect(rateLimitRetentionCutoff(new Date('2026-09-14T10:00:00Z'))).toEqual(
      new Date('2026-09-13T10:00:00Z'),
    );
  });
});

describe('secondsUntilWindowEnds', () => {
  it('counts down to the next hour boundary', () => {
    expect(secondsUntilWindowEnds(new Date('2026-09-14T10:59:30Z'))).toBe(30);
  });

  it('is a full hour right at a boundary', () => {
    expect(secondsUntilWindowEnds(new Date('2026-09-14T10:00:00Z'))).toBe(3600);
  });
});

describe('hashClientKey', () => {
  it('is deterministic for the same IP', () => {
    expect(hashClientKey('203.0.113.7')).toBe(hashClientKey('203.0.113.7'));
  });

  it('differs between different IPs', () => {
    expect(hashClientKey('203.0.113.7')).not.toBe(hashClientKey('203.0.113.8'));
  });

  it('never contains the raw IP as a substring', () => {
    expect(hashClientKey('203.0.113.7')).not.toContain('203.0.113.7');
  });
});

describe('extractClientIp', () => {
  it('reads the first address from a comma-separated x-forwarded-for chain', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' },
    });
    expect(extractClientIp(request)).toBe('203.0.113.7');
  });

  it('trims whitespace around the first address', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '  203.0.113.7  , 70.41.3.18' },
    });
    expect(extractClientIp(request)).toBe('203.0.113.7');
  });

  it('returns null when the header is absent, never a fabricated address', () => {
    const request = new Request('https://example.com');
    expect(extractClientIp(request)).toBeNull();
  });
});
