import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { isLocale, LOCALE_NAMES, LOCALE_SHORT, otherLocale } from '@/lib/i18n';
import { MapShell } from '@/components/map/MapShell';
import styles from './page.module.css';

/**
 * TASK-005 scope: the branded Warsaw map shell only. No geolocation, no
 * toilet markers, no bottom sheet — see `tasks/005-render-map-shell.md`.
 * The TASK-001 "map does not work yet" placeholder is gone because it no
 * longer is; nothing here overclaims what the screen does beyond that.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const target = otherLocale(locale);

  return (
    <main className={styles.shell}>
      <header className={styles.topBar}>
        <div className={styles.identity}>
          <h1 className={styles.wordmark}>GdzieKibel.pl</h1>
          <p className={styles.stage}>{dictionary.stage}</p>
        </div>

        <nav aria-label={dictionary.languageSwitchLabel}>
          <Link className={styles.language} href={`/${target}`} hrefLang={target} lang={target}>
            <span aria-hidden="true">{LOCALE_SHORT[target]}</span>
            <span className={styles.visuallyHidden}>{LOCALE_NAMES[target]}</span>
          </Link>
        </nav>
      </header>

      <div className={styles.mapArea}>
        <MapShell dictionary={dictionary} />
      </div>
    </main>
  );
}
