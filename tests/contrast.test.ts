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
const PAIRS = [
  ['text1', 'bg'], ['text2', 'bg'], ['text3', 'bg'], ['gold', 'bg'],
  ['text1', 'surface'], ['text2', 'surface'], ['text3', 'surface'], ['gold', 'surface'],
  ['btn-text', 'btn'],
];

describe('visual directions (T7) pass AA contrast', () => {
  const html = readFileSync('public/directions/index.html', 'utf8');
  const blocks = [...html.matchAll(/\[data-dir="(\w)"\] \{([^}]+)\}/g)];

  it('defines three directions', () => expect(blocks.map((b) => b[1])).toEqual(['a', 'b', 'c']));

  for (const [, dir, body] of blocks) {
    const tokens = Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\b/g)].map((m) => [m[1], m[2]]));
    it.each(PAIRS)(`${dir}: %s on %s`, (fg, bg) => {
      expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
    });
  }
});
