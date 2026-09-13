import styles from './page.module.css';

/**
 * Minimal foundation shell.
 *
 * TASK-001 scope: prove the stack and the deployment path only. This page must
 * not render a map, request geolocation, or query toilet data.
 */
export default function HomePage() {
  return (
    <main className={styles.shell}>
      <p className={styles.stage}>Fundament projektu</p>
      <h1 className={styles.wordmark}>GdzieKibel.pl</h1>
      <div className={styles.rule} aria-hidden="true" />
      <p className={styles.placeholder}>
        Aplikacja jest w budowie. Mapa i wyszukiwanie toalet jeszcze nie działają.
      </p>
    </main>
  );
}
