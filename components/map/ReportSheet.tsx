'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { submitReport } from '@/lib/reports/submit-report';
import { ISSUE_TYPES, type IssueType } from '@/lib/reports/types';
import styles from './MapShell.module.css';

/** Maps each issue type to its `Dictionary` key, in `BRAND.md` "Reporting"'s
 * documented order — the same order `docs/adr/0015-toilet-reports.md`
 * pairs against the SQL enum. */
const REASON_LABEL: Record<IssueType, keyof Dictionary> = {
  closed: 'reportReasonClosed',
  does_not_exist: 'reportReasonDoesNotExist',
  wrong_hours: 'reportReasonWrongHours',
  wrong_price: 'reportReasonWrongPrice',
  access_denied: 'reportReasonAccessDenied',
  wrong_accessibility: 'reportReasonWrongAccessibility',
  other: 'reportReasonOther',
};

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

/**
 * The detail sheet's report control (TASK-020, DESIGN.md 9.4 position 8;
 * `docs/adr/0015-toilet-reports.md`). No rate-limiting or abuse handling
 * here — `TASK-021`'s job. A failed submission keeps whatever the user
 * already picked/typed so retrying does not mean starting over.
 */
export function ReportSheet({
  toiletId,
  dictionary,
  onClose,
}: {
  toiletId: string;
  dictionary: Dictionary;
  onClose: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [issueType, setIssueType] = useState<IssueType | null>(null);
  const [note, setNote] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function handleSubmit() {
    if (issueType === null) return;
    setSubmitState('submitting');
    const result = await submitReport({ toiletId, issueType, note });
    setSubmitState(result.ok ? 'success' : 'error');
  }

  return (
    <div className={styles.scrim}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="false"
        aria-labelledby="report-sheet-heading"
      >
        <button type="button" className={styles.detailClose} onClick={onClose}>
          {dictionary.detailClose}
        </button>
        <h2
          id="report-sheet-heading"
          ref={headingRef}
          tabIndex={-1}
          className={styles.sheetHeadline}
        >
          {dictionary.reportHeadline}
        </h2>

        {submitState === 'success' ? (
          <p className={styles.sheetBody}>{dictionary.reportSuccess}</p>
        ) : (
          <>
            <fieldset
              className={styles.filterSection}
              aria-labelledby="report-sheet-heading"
              disabled={submitState === 'submitting'}
            >
              {ISSUE_TYPES.map((type) => (
                <label key={type} className={styles.filterOption}>
                  <input
                    type="radio"
                    name="issueType"
                    checked={issueType === type}
                    onChange={() => setIssueType(type)}
                  />
                  {dictionary[REASON_LABEL[type]]}
                </label>
              ))}
            </fieldset>

            <label className={styles.filterSection}>
              <span className={styles.filterSectionTitle}>{dictionary.reportNoteLabel}</span>
              <textarea
                className={styles.reportNote}
                value={note}
                disabled={submitState === 'submitting'}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>

            {submitState === 'error' && (
              <p className={styles.sheetBody}>{dictionary.reportFailure}</p>
            )}

            <button
              type="button"
              className={styles.sheetPrimary}
              disabled={issueType === null || submitState === 'submitting'}
              onClick={handleSubmit}
            >
              {submitState === 'error' ? dictionary.reportRetry : dictionary.reportSubmit}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
