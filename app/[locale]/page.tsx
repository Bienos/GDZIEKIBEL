import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { isLocale, LOCALE_NAMES, LOCALE_SHORT, otherLocale } from '@/lib/i18n';
import styles from './page.module.css';

/**
 * Minimal foundation shell.
 *
 * TASK-001 scope: prove the stack and the deployment path only. This page must
 * not render a map, request geolocation, or query toilet data. The language
 * switch was added afterwards at the project owner's request.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const target = otherLocale(locale);

  return (
    <main className={styles.shell}>
      <nav className={styles.languages} aria-label={dictionary.languageSwitchLabel}>
        <Link className={styles.language} href={`/${target}`} hrefLang={target} lang={target}>
          <span aria-hidden="true">{LOCALE_SHORT[target]}</span>
          <span className={styles.visuallyHidden}>{LOCALE_NAMES[target]}</span>
        </Link>
      </nav>

      <div className={styles.content}>
        <p className={styles.stage}>{dictionary.stage}</p>
        <h1 className={styles.wordmark}>GdzieKibel.pl</h1>
        <div className={styles.rule} aria-hidden="true" />
        <p className={styles.placeholder}>{dictionary.placeholder}</p>
      </div>
    </main>
  );
}
