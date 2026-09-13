import { describe, expect, it, vi } from 'vitest';
import { submitReport } from '@/lib/reports/submit-report';

const TOILET_ID = 'a1b2c3d4-0000-4000-8000-000000000000';

function fakeFetch(response: Partial<Response>): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 201,
  }) as unknown as typeof fetch;
}

describe('submitReport', () => {
  it('posts to the toilet-scoped reports endpoint with the issueType', async () => {
    const fetchImpl = fakeFetch({});

    await submitReport({ toiletId: TOILET_ID, issueType: 'closed' }, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/toilets/${TOILET_ID}/reports`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ issueType: 'closed' }),
      }),
    );
  });

  it('includes a trimmed note when one is given', async () => {
    const fetchImpl = fakeFetch({});

    await submitReport(
      { toiletId: TOILET_ID, issueType: 'wrong_hours', note: '  really wrong  ' },
      fetchImpl,
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/toilets/${TOILET_ID}/reports`,
      expect.objectContaining({
        body: JSON.stringify({ issueType: 'wrong_hours', note: 'really wrong' }),
      }),
    );
  });

  it('omits the note key entirely for a blank note, rather than sending an empty string', async () => {
    const fetchImpl = fakeFetch({});

    await submitReport({ toiletId: TOILET_ID, issueType: 'other', note: '   ' }, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/toilets/${TOILET_ID}/reports`,
      expect.objectContaining({ body: JSON.stringify({ issueType: 'other' }) }),
    );
  });

  it('resolves ok on a successful submission', async () => {
    const result = await submitReport({ toiletId: TOILET_ID, issueType: 'closed' }, fakeFetch({}));

    expect(result).toEqual({ ok: true });
  });

  it('resolves a typed failure on a non-2xx response, never throwing', async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 404 });

    const result = await submitReport({ toiletId: TOILET_ID, issueType: 'closed' }, fetchImpl);

    expect(result).toEqual({ ok: false, message: 'Request failed with status 404' });
  });

  it('resolves a typed failure rather than throwing when fetch itself rejects', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const result = await submitReport({ toiletId: TOILET_ID, issueType: 'closed' }, fetchImpl);

    expect(result).toEqual({ ok: false, message: 'network down' });
  });
});
