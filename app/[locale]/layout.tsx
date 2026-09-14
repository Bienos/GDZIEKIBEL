import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { isLocale, LOCALES } from '@/lib/i18n';
import { getSiteUrl } from '@/lib/site-url';
import '../globals.css';

/** Both locales are known up front, so both pages stay static. */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/**
 * `metadataBase` (TASK-027, `docs/adr/0022-seo-share-baseline.md`) is set
 * here because this is the app's effective root layout — there is no
 * other page outside `[locale]` needing its own `<html>` shell. Required
 * for `openGraph`'s image (a relative path, resolved against the site's
 * own `opengraph-image` route) to ever produce a real absolute URL:
 * Next.js's own docs are explicit that a relative URL-based metadata
 * field without `metadataBase` is a build error, not a silent fallback.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const dictionary = getDictionary(locale);
  return {
    title: dictionary.metaTitle,
    description: dictionary.metaDescription,
    metadataBase: new URL(getSiteUrl()),
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(LOCALES.map((item) => [item, `/${item}`])),
    },
    openGraph: {
      title: dictionary.metaTitle,
      description: dictionary.metaDescription,
      url: `/${locale}`,
      siteName: dictionary.metaTitle,
      locale: locale === 'pl' ? 'pl_PL' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: dictionary.metaTitle,
      description: dictionary.metaDescription,
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b0b0b',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  // The lang attribute is why the locale lives in the route rather than in
  // component state: screen readers and translation tools read it from the
  // server-rendered document.
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
