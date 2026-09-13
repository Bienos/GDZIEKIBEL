import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from './MapShell.module.css';

/**
 * The no-results overlay (TASK-017, `docs/adr/0012-no-results-diagnosis.md`).
 * Diagnoses which of three states actually explains an empty `toilets`
 * array, checking the more likely and more directly fixable cause first:
 * an active filter, then whether the radius can still expand, then the
 * radius-exhausted state. Only ever offers the one action that can
 * actually help, never all three.
 *
 * `fill` picks the layout: `false` reuses `.preview`'s bottom-anchored
 * footprint since this replaces that preview in map view; `true` fills the
 * otherwise-empty list area in list view instead. Same component either
 * way — the diagnosis does not depend on which view is showing it.
 */
export function NoResultsState({
  dictionary,
  hasActiveFilters,
  radiusAtMax,
  fill,
  onClearFilters,
  onExpandRadius,
  onDismiss,
}: {
  dictionary: Dictionary;
  hasActiveFilters: boolean;
  radiusAtMax: boolean;
  fill: boolean;
  onClearFilters: () => void;
  onExpandRadius: () => void;
  onDismiss: () => void;
}) {
  const body = hasActiveFilters
    ? dictionary.noResultsFilteredBody
    : radiusAtMax
      ? dictionary.noResultsExhaustedBody
      : dictionary.noResultsRadiusBody;

  return (
    <div className={fill ? styles.noResultsPanel : styles.noResultsOverlay} role="status">
      <p className={styles.noResultsHeadline}>{dictionary.noResultsHeadline}</p>
      <p className={styles.noResultsBody}>{body}</p>
      {hasActiveFilters ? (
        <button type="button" className={styles.noResultsAction} onClick={onClearFilters}>
          {dictionary.filtersClear}
        </button>
      ) : radiusAtMax ? (
        <button type="button" className={styles.noResultsAction} onClick={onDismiss}>
          {dictionary.noResultsExhaustedAction}
        </button>
      ) : (
        <button type="button" className={styles.noResultsAction} onClick={onExpandRadius}>
          {dictionary.noResultsRadiusAction}
        </button>
      )}
    </div>
  );
}
