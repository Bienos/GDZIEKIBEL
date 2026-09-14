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

  // The real defect this ordering exists for: VERCEL_URL is the
  // deployment-specific host, an immutable snapshot that never receives
  // another deploy, so production must never advertise it as its own
  // canonical URL (docs/adr/0022, docs/adr/0026).
  it('prefers the stable production host over the deployment-specific one in production', () => {
    expect(
      resolveSiteUrl({
        VERCEL_ENV: 'production',
        VERCEL_PROJECT_PRODUCTION_URL: 'gdziekibel-bienos.vercel.app',
        VERCEL_URL: 'gdziekibel-3y01rbagl-bienos.vercel.app',
      }),
    ).toBe('https://gdziekibel-bienos.vercel.app');
  });

  it('keeps the deployment-specific host on a preview, which is not the production site', () => {
    expect(
      resolveSiteUrl({
        VERCEL_ENV: 'preview',
        VERCEL_PROJECT_PRODUCTION_URL: 'gdziekibel-bienos.vercel.app',
        VERCEL_URL: 'gdziekibel-3y01rbagl-bienos.vercel.app',
      }),
    ).toBe('https://gdziekibel-3y01rbagl-bienos.vercel.app');
  });

  it('still prefers an explicit SITE_URL over the stable production host', () => {
    expect(
      resolveSiteUrl({
        SITE_URL: 'https://gdziekibel.pl',
        VERCEL_ENV: 'production',
        VERCEL_PROJECT_PRODUCTION_URL: 'gdziekibel-bienos.vercel.app',
      }),
    ).toBe('https://gdziekibel.pl');
  });

  it('falls back to the deployment host when production names no stable one', () => {
    expect(
      resolveSiteUrl({ VERCEL_ENV: 'production', VERCEL_URL: 'gdziekibel-abc123.vercel.app' }),
    ).toBe('https://gdziekibel-abc123.vercel.app');
  });

  it('falls back to localhost when neither is set', () => {
    expect(resolveSiteUrl({})).toBe('http://localhost:3000');
  });
});
