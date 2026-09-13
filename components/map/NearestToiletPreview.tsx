import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { NearbyToiletResult } from '@/lib/toilets/nearby-response';
import { distanceLine, openingStatusLabel, priceLabel } from '@/lib/toilets/preview-copy';
import styles from './MapShell.module.css';

/**
 * The collapsed "nearest sensible toilet" preview (TASK-010). Always the
 * top-ranked toilet (`TASK-009`), independent of marker selection: see
 * `tasks/010-nearest-toilet-preview.md` for why this reads `toilets[0]`
 * rather than `selectedId`.
 *
 * Not modal: it does not dim or block the map, and has no CTA yet — see the
 * same task file for why one is not added until a real destination exists.
 */
export function NearestToiletPreview({
  toilet,
  dictionary,
}: {
  toilet: NearbyToiletResult;
  dictionary: Dictionary;
}) {
  return (
    <div className={styles.preview} role="region" aria-label={dictionary.previewLabel}>
      <p className={styles.previewLabel}>{dictionary.previewLabel}</p>
      <p className={styles.previewName}>{toilet.name}</p>
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
    </div>
  );
}
