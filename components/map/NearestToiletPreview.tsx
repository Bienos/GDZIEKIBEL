import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { NearbyToiletResult } from '@/lib/toilets/nearby-response';
import {
  distanceLine,
  openingStatusLabel,
  openingStatusVariant,
  priceLabel,
} from '@/lib/toilets/preview-copy';
import styles from './MapShell.module.css';

/** Maps `openingStatusVariant`'s result to the badge colour class (TASK-013). */
const STATUS_BADGE_CLASS: Record<ReturnType<typeof openingStatusVariant>, string | undefined> = {
  open: styles.previewBadgeStatusOpen,
  closed: styles.previewBadgeStatusClosed,
  uncertain: styles.previewBadgeStatusUncertain,
};

/**
 * The collapsed "nearest sensible toilet" preview (TASK-010). Always the
 * top-ranked toilet (`TASK-009`), independent of marker selection: see
 * `tasks/010-nearest-toilet-preview.md` for why this reads `toilets[0]`
 * rather than `selectedId`.
 *
 * Not modal: it does not dim or block the map. Tapping it opens the detail
 * sheet for this toilet (`TASK-011`, via `onSelect`) — the destination
 * `TASK-010` deferred because it did not exist yet.
 */
export function NearestToiletPreview({
  toilet,
  dictionary,
  onSelect,
}: {
  toilet: NearbyToiletResult;
  dictionary: Dictionary;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.preview}
      aria-label={`${dictionary.previewOpenDetailsLabel}: ${toilet.name}`}
      onClick={onSelect}
    >
      <p className={styles.previewLabel}>{dictionary.previewLabel}</p>
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
          {priceLabel(toilet.priceState, dictionary)}
        </span>
      </div>
    </button>
  );
}
