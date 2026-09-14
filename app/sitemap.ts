import type { MetadataRoute } from 'next';
import { LOCALES } from '@/lib/i18n';
import { getSiteUrl } from '@/lib/site-url';

/**
 * Lists the real, indexable pages (TASK-027,
 * `docs/adr/0022-seo-share-baseline.md`): `/pl` and `/en`, the only two
 * canonical URLs this app serves. The bare `/` redirect target is
 * deliberately excluded — a sitemap should point crawlers at final
 * canonical URLs, not a redirecting one. No per-toilet page exists yet
 * (`PRODUCT.md` section 17 rules out building one solely for SEO).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return LOCALES.map((locale) => ({
    url: `${siteUrl}/${locale}`,
    changeFrequency: 'weekly',
    priority: 1,
  }));
}
