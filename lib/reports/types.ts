/**
 * The seven MVP report reasons (`PRODUCT.md` section 6.4, `BRAND.md`
 * "Reporting"). Mirrors the SQL `toilet_report_issue_type` enum member for
 * member; `tests/unit/toilets-types.test.ts`'s sibling test for this file
 * keeps the two in step.
 */
export const ISSUE_TYPES = [
  'closed',
  'does_not_exist',
  'wrong_hours',
  'wrong_price',
  'access_denied',
  'wrong_accessibility',
  'other',
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];
