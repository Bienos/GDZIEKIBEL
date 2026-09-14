/**
 * The nine funnel events `PRODUCT.md` section 13's FR-09 names (TASK-023,
 * `docs/adr/0018-first-party-analytics.md`); "location granted/denied" is
 * one bullet there but two distinct, already-distinct-in-code outcomes
 * here. Mirrors the SQL `analytics_event_name` enum member for member;
 * `tests/unit/analytics-types.test.ts` keeps the two in step.
 */
export const EVENT_NAMES = [
  'app_opened',
  'location_granted',
  'location_denied',
  'results_loaded',
  'no_results',
  'toilet_selected',
  'navigation_clicked',
  'filter_applied',
  'report_submitted',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];
