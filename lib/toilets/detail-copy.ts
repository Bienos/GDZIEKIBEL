import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { ConfidenceLevel, FeatureState } from './types';

/**
 * Pure copy-mapping for the toilet detail sheet (TASK-011). Kept apart from
 * `ToiletDetailSheet.tsx` so the mapping rules are unit-testable without
 * React or the DOM. Distance/status/price copy is already covered by
 * `lib/toilets/preview-copy.ts` and reused as-is.
 */

/** Every `FeatureState` member renders distinctly; none collapses into a boolean. */
export function featureStateLabel(state: FeatureState, dictionary: Dictionary): string {
  switch (state) {
    case 'yes':
      return dictionary.detailFeatureYes;
    case 'no':
      return dictionary.detailFeatureNo;
    case 'limited':
      return dictionary.detailFeatureLimited;
    case 'unknown':
      return dictionary.detailFeatureUnknown;
  }
}

/**
 * Every toilet in the pipeline today carries `'low'` (nothing sets it
 * higher yet — TASK-019's job); this reports that real value rather than
 * fabricating a higher confidence.
 */
export function confidenceLabel(level: ConfidenceLevel, dictionary: Dictionary): string {
  switch (level) {
    case 'high':
      return dictionary.detailConfidenceHigh;
    case 'medium':
      return dictionary.detailConfidenceMedium;
    case 'low':
      return dictionary.detailConfidenceLow;
  }
}
