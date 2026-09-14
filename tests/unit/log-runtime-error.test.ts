import { afterEach, describe, expect, it, vi } from 'vitest';
import { logRuntimeError } from '@/lib/observability/log-runtime-error';

function lastLoggedEntry(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const [line] = spy.mock.calls.at(-1) ?? [];
  return JSON.parse(String(line)) as Record<string, unknown>;
}

describe('logRuntimeError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs a real Error with its name, message, and the given context', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logRuntimeError('POST /api/toilets/nearby', new Error('connection refused'));

    const entry = lastLoggedEntry(spy);
    expect(entry).toMatchObject({
      level: 'error',
      source: 'POST /api/toilets/nearby',
      name: 'Error',
      message: expect.stringContaining('connection refused'),
    });
    expect(typeof entry.timestamp).toBe('string');
  });

  it('handles a thrown non-Error value without crashing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logRuntimeError('POST /api/analytics/events', 'a raw string, not an Error');

    const entry = lastLoggedEntry(spy);
    expect(entry.name).toBe('UnknownError');
    expect(entry.message).toContain('a raw string, not an Error');
  });

  it('redacts a coordinate that ends up in the error message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logRuntimeError(
      'POST /api/toilets/[id]/reports',
      new Error('unexpected value near 52.2297,21.0122'),
    );

    const entry = lastLoggedEntry(spy);
    expect(entry.message).not.toContain('52.2297');
    expect(entry.message).not.toContain('21.0122');
    expect(entry.message).toContain('[REDACTED_COORDINATES]');
  });
});
