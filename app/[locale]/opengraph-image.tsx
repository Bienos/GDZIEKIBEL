import { ImageResponse } from 'next/og';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { isLocale, LOCALES } from '@/lib/i18n';

/**
 * Code-generated, locale-aware Open Graph/Twitter share image (TASK-027,
 * `docs/adr/0022-seo-share-baseline.md`): no design asset pipeline exists
 * in this repository, so this is built from this project's own
 * `tokens.css` colours and the real per-locale `metaTitle`/`metaDescription`
 * copy `generateMetadata` already uses — never invented or placeholder text.
 *
 * `generateStaticParams` here (mirroring the layout's own) is what lets
 * Next.js statically optimise this route per locale at build time, rather
 * than regenerating the image on every request.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const alt = 'GdzieKibel.pl';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dictionary = isLocale(locale) ? getDictionary(locale) : getDictionary('pl');

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: '#0b0b0b',
        padding: '80px 96px',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 96,
          fontWeight: 800,
          color: '#ffd800',
          fontFamily: 'Arial, sans-serif',
          letterSpacing: -2,
          lineHeight: 1,
        }}
      >
        {dictionary.metaTitle}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 32,
          fontSize: 40,
          fontWeight: 600,
          color: '#f5f2ea',
          fontFamily: 'Arial, sans-serif',
          maxWidth: 900,
          lineHeight: 1.3,
        }}
      >
        {dictionary.metaDescription}
      </div>
    </div>,
    { ...size },
  );
}
