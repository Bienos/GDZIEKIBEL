import { describe, expect, it, vi } from 'vitest';
import { reportEvent } from '@/lib/analytics/report-event';

function fakeFetch(response: Partial<Response>): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 201,
  }) as unknown as typeof fetch;
}

describe('reportEvent', () => {
  it('posts to the analytics endpoint with the given eventName', async () => {
    const fetchImpl = fakeFetch({});

    await reportEvent('app_opened', fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/analytics/events',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ eventName: 'app_opened' }),
      }),
    );
  });

  it('never throws on a non-2xx response', async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 500 });

    await expect(reportEvent('app_opened', fetchImpl)).resolves.toBeUndefined();
  });

  it('never throws when fetch itself rejects', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    await expect(reportEvent('app_opened', fetchImpl)).resolves.toBeUndefined();
  });
});
