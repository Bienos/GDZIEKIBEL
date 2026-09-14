import { describe, expect, it } from 'vitest';
import { parseAnalyticsRequest } from '@/lib/analytics/analytics-request';

describe('parseAnalyticsRequest', () => {
  it('accepts a valid, known eventName', () => {
    expect(parseAnalyticsRequest({ eventName: 'app_opened' })).toEqual({
      ok: true,
      eventName: 'app_opened',
    });
  });

  it('rejects an eventName outside the nine documented events', () => {
    expect(parseAnalyticsRequest({ eventName: 'button_hovered' }).ok).toBe(false);
  });

  it('rejects a missing eventName entirely', () => {
    expect(parseAnalyticsRequest({}).ok).toBe(false);
    expect(parseAnalyticsRequest(null).ok).toBe(false);
    expect(parseAnalyticsRequest('not an object').ok).toBe(false);
  });

  it('rejects an unrecognised field rather than silently ignoring it', () => {
    expect(parseAnalyticsRequest({ eventName: 'app_opened', sessionId: 'abc-123' }).ok).toBe(false);
  });

  it('never echoes the submitted value in a failure message', () => {
    const result = parseAnalyticsRequest({ eventName: 'not-a-real-event' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).not.toContain('not-a-real-event');
  });
});
