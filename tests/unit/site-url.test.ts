import { describe, expect, it } from 'vitest';
import { resolveSiteUrl } from '@/lib/site-url';

describe('resolveSiteUrl', () => {
  it('prefers an explicit SITE_URL override', () => {
    expect(
      resolveSiteUrl({ SITE_URL: 'https://gdziekibel.pl', VERCEL_URL: 'preview.vercel.app' }),
    ).toBe('https://gdziekibel.pl');
  });

  it("falls back to Vercel's own auto-provided host, adding https", () => {
    expect(resolveSiteUrl({ VERCEL_URL: 'gdziekibel-abc123.vercel.app' })).toBe(
      'https://gdziekibel-abc123.vercel.app',
    );
  });

  it('falls back to localhost when neither is set', () => {
    expect(resolveSiteUrl({})).toBe('http://localhost:3000');
  });
});
