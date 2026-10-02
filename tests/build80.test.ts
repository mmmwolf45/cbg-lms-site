import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadCourses } from '../content/schema';
import { countText } from '../src/motion/counters';
import { activeUnit, cumulative, hoursAt, scrubFloors, timedFloors } from '../src/motion/build80';

const iosh = loadCourses().find((c) => c.slug === 'iosh-level-3')!;
const glh = iosh.units!.units.map((u) => u.glh);
// Four equal cards with a small gap between them, as fractions of the unit list.
const spans = [[0, 0.24], [0.25, 0.49], [0.5, 0.74], [0.75, 1]];

describe('cumulative hours (T24)', () => {
  it('runs 21 -> 48 -> 60 -> 80 for the IOSH units', () => {
    expect(glh).toEqual([21, 27, 12, 20]);
    expect(cumulative(glh)).toEqual([21, 48, 60, 80]);
  });

  it('ends on the total the hero counts to', () => {
    expect(iosh.hero.facts.some((f) => f.count === cumulative(glh).at(-1))).toBe(true);
  });

  it('shows each floor adding its own hours, ending on exactly the final text', () => {
    expect(hoursAt([0, 0, 0, 0], glh)).toBe(0);
    expect(hoursAt([1, 1, 0, 0], glh)).toBe(48);
    expect(hoursAt([1, 1, 0.5, 0], glh)).toBe(54);
    expect(countText(hoursAt([1, 1, 1, 1], glh), 80, '80')).toBe('80');
    expect(countText(hoursAt([1, 0.5, 0, 0], glh), 80, '80')).toBe('34');
  });
});

describe('laptop scrub: which floor is built for a given progress', () => {
  it('nothing before the list reaches the middle, everything by its end', () => {
    expect(scrubFloors(0, spans)).toEqual([0, 0, 0, 0]);
    expect(scrubFloors(1, spans)).toEqual([1, 1, 1, 1]);
  });

  it('builds floors in order, each one while the first 60% of its card crosses the middle', () => {
    expect(scrubFloors(0.24 * 0.6, spans)[0]).toBeCloseTo(1);
    expect(scrubFloors(0.3, spans).map((f) => f > 0)).toEqual([true, true, false, false]);
    expect(scrubFloors(0.65, spans).map((f) => f >= 1)).toEqual([true, true, true, false]);
    for (let p = 0; p <= 1; p += 0.01) {
      const fs = scrubFloors(p, spans);
      fs.slice(1).forEach((f, i) => expect(f).toBeLessThanOrEqual(fs[i])); // never a floor above an unbuilt one
    }
  });

  it('makes exactly the card at the middle active (the first before any has reached it)', () => {
    expect(activeUnit(0, spans)).toBe(0);
    expect(activeUnit(0.245, spans)).toBe(0);
    expect(activeUnit(0.25, spans)).toBe(1);
    expect(activeUnit(0.99, spans)).toBe(3);
  });
});

describe('phone build: floors bottom-up, 0.25s apart', () => {
  it('starts empty and ends fully built', () => {
    expect(timedFloors(0, 4)).toEqual([0, 0, 0, 0]);
    expect(timedFloors(0.25 * 3 + 0.8, 4)).toEqual([1, 1, 1, 1]);
  });

  it('starts each floor 0.25s after the one below', () => {
    expect(timedFloors(0.25, 4).map((f) => f > 0)).toEqual([true, false, false, false]);
    expect(timedFloors(0.51, 4).map((f) => f > 0)).toEqual([true, true, true, false]);
  });
});

describe('dimmed unit cards stay readable', () => {
  // WCAG contrast of #rrggbb colours (as tests/contrast.test.ts).
  const lum = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const mix = (fg: string, bg: string, a: number) =>
    '#' + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a))
      .toString(16).padStart(2, '0')).join('');

  it('keeps the softest text above 4.5:1 at the dimmed opacity', () => {
    const css = readFileSync('src/styles/build80.css', 'utf8');
    const tokens = readFileSync('src/styles/tokens.css', 'utf8');
    const t = (name: string) => tokens.match(new RegExp(`--cbg-${name}:\\s*(#[0-9A-Fa-f]{6})`))![1];
    const dim = Number(css.match(/:not\(\.is-active\) \{ opacity: ([\d.]+)/)![1]);
    expect(dim).toBeLessThan(1);
    // The card sits on the page background or a surface; check both (the lighter surface is the worst case).
    for (const bg of [t('bg'), t('surface')]) {
      for (const fg of ['text-3', 'gold']) expect(contrast(mix(t(fg), bg, dim), bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
