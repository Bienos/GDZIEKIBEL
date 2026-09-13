import { describe, expect, it } from 'vitest';
import {
  parseReportRequest,
  parseToiletId,
  REPORT_NOTE_MAX_LENGTH,
} from '@/lib/reports/report-request';

const VALID_ID = 'a1b2c3d4-0000-4000-8000-000000000000';

describe('parseReportRequest', () => {
  it('accepts a valid issueType with no note, defaulting note to null', () => {
    expect(parseReportRequest({ issueType: 'closed' })).toEqual({
      ok: true,
      params: { issueType: 'closed', note: null },
    });
  });

  it('accepts a valid issueType with a note, trimmed', () => {
    expect(parseReportRequest({ issueType: 'wrong_hours', note: '  really wrong  ' })).toEqual({
      ok: true,
      params: { issueType: 'wrong_hours', note: 'really wrong' },
    });
  });

  it('treats a blank note the same as an omitted one: null, not an empty string', () => {
    expect(parseReportRequest({ issueType: 'other', note: '   ' })).toEqual({
      ok: true,
      params: { issueType: 'other', note: null },
    });
  });

  it('rejects an issueType outside the seven documented reasons', () => {
    expect(parseReportRequest({ issueType: 'smells_bad' }).ok).toBe(false);
  });

  it('rejects a missing issueType entirely', () => {
    expect(parseReportRequest({}).ok).toBe(false);
    expect(parseReportRequest(null).ok).toBe(false);
    expect(parseReportRequest('not an object').ok).toBe(false);
  });

  it('rejects a note over the documented length cap', () => {
    const tooLong = 'x'.repeat(REPORT_NOTE_MAX_LENGTH + 1);
    expect(parseReportRequest({ issueType: 'other', note: tooLong }).ok).toBe(false);
  });

  it('accepts a note exactly at the length cap', () => {
    const atCap = 'x'.repeat(REPORT_NOTE_MAX_LENGTH);
    expect(parseReportRequest({ issueType: 'other', note: atCap }).ok).toBe(true);
  });

  it('rejects an unrecognised top-level field rather than silently ignoring it', () => {
    expect(parseReportRequest({ issueType: 'closed', reporterEmail: 'x@example.com' }).ok).toBe(
      false,
    );
  });

  it('never echoes the submitted note in a failure message', () => {
    const result = parseReportRequest({ issueType: 'not-a-real-reason' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).not.toContain('not-a-real-reason');
  });
});

describe('parseToiletId', () => {
  it('accepts a well-formed UUID', () => {
    expect(parseToiletId(VALID_ID)).toEqual({ ok: true, id: VALID_ID });
  });

  it('rejects a non-UUID string', () => {
    expect(parseToiletId('not-a-uuid').ok).toBe(false);
    expect(parseToiletId('').ok).toBe(false);
  });
});
