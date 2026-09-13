import type { Dictionary } from '@/lib/i18n/dictionaries';
import { featureStateLabel } from '@/lib/toilets/detail-copy';
import type { NearbyToiletResult } from '@/lib/toilets/nearby-response';
import {
  distanceLine,
  openingStatusLabel,
  openingStatusVariant,
  priceAmountLabel,
} from '@/lib/toilets/preview-copy';
import styles from './MapShell.module.css';

const STATUS_BADGE_CLASS: Record<ReturnType<typeof openingStatusVariant>, string | undefined> = {
  open: styles.previewBadgeStatusOpen,
  closed: styles.previewBadgeStatusClosed,
  uncertain: styles.previewBadgeStatusUncertain,
};

/**
 * The accessible list view (TASK-015, DESIGN.md 9.5): every toilet in
 * `toilets`, in the array's existing order — already the recommendation
 * ranking (TASK-009), so no separate sort is applied here. Independent of
 * tile/map state, the same reasoning already applied to the fetch and the
 * preview. `DESIGN.md` section 14: "Map has equivalent list
 * representation."
 */
export function ToiletListView({
  toilets,
  dictionary,
  onSelect,
}: {
  toilets: NearbyToiletResult[];
  dictionary: Dictionary;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className={styles.list} aria-label={dictionary.listAccessibleLabel}>
      {toilets.map((toilet) => (
        <li key={toilet.id}>
          <button
            type="button"
            className={styles.listItem}
            aria-label={`${dictionary.previewOpenDetailsLabel}: ${toilet.name}`}
            onClick={() => onSelect(toilet.id)}
          >
            <p className={styles.previewName}>{toilet.name}</p>
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
              {/* DESIGN.md 9.5: "at most two key feature badges." Only the
                  two PRODUCT.md section 6.3 filter dimensions, only when
                  known — an "unknown" badge on every row would be exactly
                  the clutter that section's "no oversized cards" rule
                  warns against. */}
              {toilet.features.wheelchair !== 'unknown' && (
                <span className={styles.listFeatureBadge}>
                  {dictionary.detailFeatureWheelchair}:{' '}
                  {featureStateLabel(toilet.features.wheelchair, dictionary)}
                </span>
              )}
              {toilet.features.changingTable !== 'unknown' && (
                <span className={styles.listFeatureBadge}>
                  {dictionary.detailFeatureChangingTable}:{' '}
                  {featureStateLabel(toilet.features.changingTable, dictionary)}
                </span>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
