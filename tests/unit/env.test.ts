import { describe, expect, it } from 'vitest';
import { parseServerEnv } from '@/lib/env/server';

describe('parseServerEnv', () => {
  it('accepts a valid postgres connection string', () => {
    const env = parseServerEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/gdziekibel_test',
    });

    expect(env.NODE_ENV).toBe('test');
    expect(env.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/gdziekibel_test');
  });

  it('defaults NODE_ENV to development when it is absent', () => {
    const env = parseServerEnv({ DATABASE_URL: 'postgres://localhost:5432/gdziekibel_dev' });

    expect(env.NODE_ENV).toBe('development');
  });

  it('rejects a missing DATABASE_URL instead of inventing one', () => {
    expect(() => parseServerEnv({ NODE_ENV: 'test' })).toThrowError(/DATABASE_URL/);
  });

  it('rejects a connection string that is not a postgres URL', () => {
    expect(() =>
      parseServerEnv({ NODE_ENV: 'test', DATABASE_URL: 'mysql://localhost:3306/gdziekibel' }),
    ).toThrowError(/postgres/);
  });

  it('does not echo the offending value in the error message', () => {
    const secret = 'postgres-but-not-a-url-with-a-secret';

    expect(() => parseServerEnv({ NODE_ENV: 'test', DATABASE_URL: secret })).toThrowError(
      expect.objectContaining({ message: expect.not.stringContaining(secret) }),
    );
  });
});
