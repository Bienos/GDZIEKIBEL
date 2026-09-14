import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

/**
 * Allows crawling the indexable home page (`PRODUCT.md` section 17) and
 * points at the real sitemap (TASK-027,
 * `docs/adr/0022-seo-share-baseline.md`). No route needs disallowing yet:
 * `/api/*` are POST-only write/read endpoints crawlers cannot usefully
 * request anyway, and no private/user-specific page exists.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
