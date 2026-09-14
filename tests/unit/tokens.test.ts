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

/**
 * WCAG contrast guard (TASK-026, `docs/adr/0021-accessible-dialog-names-and-contrast.md`):
 * reads the real hex values out of `tokens.css` — never hardcodes them here
 * — and computes the real relative-luminance contrast ratio, the same
 * formula a real Lighthouse `color-contrast` audit uses, so a future edit
 * to either raw palette value cannot silently regress below WCAG AA
 * without a failing test.
 */
function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const linearize = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function readHexToken(css: string, token: string): string {
  const match = new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!match?.[1]) throw new Error(`token ${token} not found`);
  return match[1];
}

describe('--text-muted contrast against --bg-primary', () => {
  it('meets WCAG AA (4.5:1) for normal text', () => {
    const muted = readHexToken(tokensCss, '--color-muted-500');
    const paper = readHexToken(tokensCss, '--color-paper-50');

    expect(contrastRatio(muted, paper)).toBeGreaterThanOrEqual(4.5);
  });
});
