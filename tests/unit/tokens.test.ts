import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const tokensCss = readFileSync(
  fileURLToPath(new URL('../../app/tokens.css', import.meta.url)),
  'utf8',
);

/**
 * Foundation guard: the design token contract required by TASK-001 must exist
 * centrally, so later slices can rely on semantic names instead of raw hex.
 */
describe('design tokens', () => {
  const requiredTokens = [
    '--bg-primary',
    '--text-primary',
    '--action-primary',
    '--accent-editorial',
    '--status-open',
    '--status-closed',
    '--status-uncertain',
    '--space-base',
  ];

  it.each(requiredTokens)('declares %s', (token) => {
    expect(tokensCss).toContain(`${token}:`);
  });

  it('keeps the 8 px spacing baseline from DESIGN.md', () => {
    expect(tokensCss).toMatch(/--space-base:\s*8px/);
  });
});
