'use client';

import { useEffect, useRef } from 'react';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { NearbyFilters } from '@/lib/toilets/filter-nearby';
import styles from './MapShell.module.css';

/**
 * The filter sheet (TASK-016, DESIGN.md 9.6): four sections, five toggles.
 * No live "(N)" result count — see `tasks/016-core-filters.md` for why.
 *
 * Uncontrolled from this component's own perspective: `filters` and
 * `onChange` are the single source of truth, owned by `MapShell`, so
 * "Apply" can send exactly what is checked right now without a second,
 * duplicated draft state.
 */
export function FiltersSheet({
  filters,
  dictionary,
  onChange,
  onApply,
  onClear,
  onClose,
}: {
  filters: NearbyFilters;
  dictionary: Dictionary;
  onChange: (filters: NearbyFilters) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function toggle(key: keyof NearbyFilters) {
    onChange({ ...filters, [key]: !filters[key] });
  }

  return (
    <div className={styles.scrim}>
      <div className={styles.sheet} role="dialog" aria-modal="false">
        <button type="button" className={styles.detailClose} onClick={onClose}>
          {dictionary.detailClose}
        </button>
        <h2 ref={headingRef} tabIndex={-1} className={styles.sheetHeadline}>
          {dictionary.filtersToggleLabel}
        </h2>

        <fieldset className={styles.filterSection}>
          <legend className={styles.filterSectionTitle}>{dictionary.filtersSectionStatus}</legend>
          <label className={styles.filterOption}>
            <input
              type="checkbox"
              checked={filters.openNow ?? false}
              onChange={() => toggle('openNow')}
            />
            {dictionary.filterOpenNow}
          </label>
        </fieldset>

        <fieldset className={styles.filterSection}>
          <legend className={styles.filterSectionTitle}>{dictionary.filtersSectionPrice}</legend>
          <label className={styles.filterOption}>
            <input
              type="checkbox"
              checked={filters.free ?? false}
              onChange={() => toggle('free')}
            />
            {dictionary.filterFree}
          </label>
        </fieldset>

        <fieldset className={styles.filterSection}>
          <legend className={styles.filterSectionTitle}>
            {dictionary.filtersSectionAccessibility}
          </legend>
          <label className={styles.filterOption}>
            <input
              type="checkbox"
              checked={filters.wheelchairAccessible ?? false}
              onChange={() => toggle('wheelchairAccessible')}
            />
            {dictionary.detailFeatureWheelchair}
          </label>
        </fieldset>

        <fieldset className={styles.filterSection}>
          <legend className={styles.filterSectionTitle}>
            {dictionary.filtersSectionAmenities}
          </legend>
          <label className={styles.filterOption}>
            <input
              type="checkbox"
              checked={filters.babyChanging ?? false}
              onChange={() => toggle('babyChanging')}
            />
            {dictionary.detailFeatureChangingTable}
          </label>
          <label className={styles.filterOption}>
            <input
              type="checkbox"
              checked={filters.open24h ?? false}
              onChange={() => toggle('open24h')}
            />
            {dictionary.filterOpen24h}
          </label>
        </fieldset>

        <button type="button" className={styles.sheetPrimary} onClick={onApply}>
          {dictionary.filtersApply}
        </button>
        <button type="button" className={styles.sheetSecondary} onClick={onClear}>
          {dictionary.filtersClear}
        </button>
      </div>
    </div>
  );
}
