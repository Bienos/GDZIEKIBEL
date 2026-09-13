'use client';

import { useEffect, useRef } from 'react';
import { buildWalkingNavigationUrl } from '@/lib/external-navigation/build-navigation-url';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { confidenceLabel, featureStateLabel } from '@/lib/toilets/detail-copy';
import type { NearbyToiletResult } from '@/lib/toilets/nearby-response';
import { distanceLine, openingStatusLabel, priceLabel } from '@/lib/toilets/preview-copy';
import styles from './MapShell.module.css';

/**
 * The toilet detail sheet (TASK-011, DESIGN.md 9.4). Shows every value
 * FR-05 lists that the nearby API actually returns today: name, distance +
 * ETA, opening status + price, a navigation CTA (TASK-012), accessibility
 * features, and a data-confidence hint. No hours, no report control — see
 * `tasks/011-toilet-detail-sheet.md` for why each is deliberately absent
 * rather than an oversight.
 */
export function ToiletDetailSheet({
  toilet,
  dictionary,
  onClose,
}: {
  toilet: NearbyToiletResult;
  dictionary: Dictionary;
  onClose: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className={styles.scrim}>
      <div className={styles.sheet} role="dialog" aria-modal="false">
        <button type="button" className={styles.detailClose} onClick={onClose}>
          {dictionary.detailClose}
        </button>
        <h2 ref={headingRef} tabIndex={-1} className={styles.sheetHeadline}>
          {toilet.name}
        </h2>
        <p className={styles.previewDistance}>
          {distanceLine(toilet.distanceMeters, toilet.approxWalkingMinutes, dictionary)}
        </p>
        <div className={styles.previewBadges}>
          <span className={styles.previewBadgeStatus}>
            {openingStatusLabel(toilet.openingStatus, dictionary)}
          </span>
          <span className={styles.previewBadgePrice}>
            {priceLabel(toilet.priceState, dictionary)}
          </span>
        </div>
        <a
          className={styles.detailNavigate}
          href={buildWalkingNavigationUrl({ lat: toilet.lat, lng: toilet.lng })}
          target="_blank"
          rel="noopener noreferrer"
        >
          {dictionary.detailNavigateCta}
        </a>
        <p className={styles.detailNavigatePunchline}>{dictionary.detailNavigatePunchline}</p>
        <dl className={styles.detailFeatures}>
          <div className={styles.detailFeatureRow}>
            <dt className={styles.detailFeatureLabel}>{dictionary.detailFeatureWheelchair}</dt>
            <dd className={styles.detailFeatureValue}>
              {featureStateLabel(toilet.features.wheelchair, dictionary)}
            </dd>
          </div>
          <div className={styles.detailFeatureRow}>
            <dt className={styles.detailFeatureLabel}>{dictionary.detailFeatureChangingTable}</dt>
            <dd className={styles.detailFeatureValue}>
              {featureStateLabel(toilet.features.changingTable, dictionary)}
            </dd>
          </div>
          <div className={styles.detailFeatureRow}>
            <dt className={styles.detailFeatureLabel}>{dictionary.detailFeatureUnisex}</dt>
            <dd className={styles.detailFeatureValue}>
              {featureStateLabel(toilet.features.unisex, dictionary)}
            </dd>
          </div>
        </dl>
        <p className={styles.sheetPrivacyHint}>
          {confidenceLabel(toilet.confidenceLevel, dictionary)}
        </p>
      </div>
    </div>
  );
}
