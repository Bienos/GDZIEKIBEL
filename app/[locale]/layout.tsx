import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { isLocale, LOCALES } from '@/lib/i18n';
import '../globals.css';

/** Both locales are known up front, so both pages stay static. */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

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
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(LOCALES.map((item) => [item, `/${item}`])),
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
