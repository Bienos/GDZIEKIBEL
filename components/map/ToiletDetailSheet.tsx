'use client';

import { useEffect, useRef, useState } from 'react';
import { reportEvent } from '@/lib/analytics/report-event';
import { buildWalkingNavigationUrl } from '@/lib/external-navigation/build-navigation-url';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { confidenceLabel, featureStateLabel } from '@/lib/toilets/detail-copy';
import type { NearbyToiletResult } from '@/lib/toilets/nearby-response';
import {
  distanceLine,
  openingStatusLabel,
  openingStatusVariant,
  priceAmountLabel,
} from '@/lib/toilets/preview-copy';
import { ReportSheet } from './ReportSheet';
import styles from './MapShell.module.css';

/** Maps `openingStatusVariant`'s result to the badge colour class (TASK-013). */
const STATUS_BADGE_CLASS: Record<ReturnType<typeof openingStatusVariant>, string | undefined> = {
  open: styles.previewBadgeStatusOpen,
  closed: styles.previewBadgeStatusClosed,
  uncertain: styles.previewBadgeStatusUncertain,
};

/**
 * The toilet detail sheet (TASK-011, DESIGN.md 9.4). Shows every value
 * FR-05 lists that the nearby API actually returns today: name, distance +
 * ETA, opening status + price (an amount when TASK-014's charge parser
 * found one), a navigation CTA (TASK-012), accessibility features, the
 * three payment-method facts TASK-014 normalises, a data-confidence hint,
 * and a report control (TASK-020, `docs/adr/0015-toilet-reports.md`),
 * position 8, opening `ReportSheet` in place of this sheet. No hours yet —
 * see `tasks/011-toilet-detail-sheet.md` for why. Reports `navigation_clicked`
 * (TASK-023, `docs/adr/0018-first-party-analytics.md`) on the CTA's own
 * click, fire-and-forget — the link opens in a new tab, so nothing here
 * blocks or races the actual navigation.
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
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  if (reportOpen) {
    return (
      <ReportSheet
        toiletId={toilet.id}
        dictionary={dictionary}
        onClose={() => setReportOpen(false)}
      />
    );
  }

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
          <span
            className={`${styles.previewBadgeStatus} ${STATUS_BADGE_CLASS[openingStatusVariant(toilet.openingStatus)] ?? ''}`}
          >
            {openingStatusLabel(toilet.openingStatus, dictionary)}
          </span>
          <span className={styles.previewBadgePrice}>
            {priceAmountLabel(
              toilet.priceState,
              toilet.priceAmountMinor,
              toilet.currency,
              dictionary,
            )}
          </span>
        </div>
        <a
          className={styles.detailNavigate}
          href={buildWalkingNavigationUrl({ lat: toilet.lat, lng: toilet.lng })}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void reportEvent('navigation_clicked')}
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
          <div className={styles.detailFeatureRow}>
            <dt className={styles.detailFeatureLabel}>{dictionary.detailPaymentCash}</dt>
            <dd className={styles.detailFeatureValue}>
              {featureStateLabel(toilet.paymentMethods.cash, dictionary)}
            </dd>
          </div>
          <div className={styles.detailFeatureRow}>
            <dt className={styles.detailFeatureLabel}>{dictionary.detailPaymentCards}</dt>
            <dd className={styles.detailFeatureValue}>
              {featureStateLabel(toilet.paymentMethods.cards, dictionary)}
            </dd>
          </div>
          <div className={styles.detailFeatureRow}>
            <dt className={styles.detailFeatureLabel}>{dictionary.detailPaymentCoins}</dt>
            <dd className={styles.detailFeatureValue}>
              {featureStateLabel(toilet.paymentMethods.coins, dictionary)}
            </dd>
          </div>
        </dl>
        <p className={styles.sheetPrivacyHint}>
          {confidenceLabel(toilet.confidenceLevel, dictionary)}
        </p>
        <button type="button" className={styles.sheetSecondary} onClick={() => setReportOpen(true)}>
          {dictionary.reportControlLabel}
        </button>
      </div>
    </div>
  );
}
