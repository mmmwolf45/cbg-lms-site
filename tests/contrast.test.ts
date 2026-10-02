import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// WCAG 2.2 contrast ratio between two #rrggbb colours.
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Every text colour is used at body or label size, so all pairs must reach 4.5:1 (AA, normal text).
describe('final tokens (T9) pass AA contrast', () => {
  const css = readFileSync('src/styles/tokens.css', 'utf8');
  const t = Object.fromEntries([...css.matchAll(/--cbg-([\w-]+):\s*(#[0-9A-Fa-f]{6})\b/g)].map((m) => [m[1], m[2]]));
  it.each([
    ['text-1', 'bg'], ['text-2', 'bg'], ['text-3', 'bg'], ['gold', 'bg'],
    ['text-1', 'bg-2'], ['text-2', 'bg-2'], ['text-3', 'bg-2'], ['gold', 'bg-2'],
    ['text-1', 'surface'], ['text-2', 'surface'], ['text-3', 'surface'], ['gold', 'surface'],
    ['btn-text', 'btn'],
  ])('%s on %s', (fg, bg) => expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5));
});
