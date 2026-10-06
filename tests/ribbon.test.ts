import { describe, expect, it } from 'vitest';
import { colourAt, drawnIn, mid, rowsOf, strands } from '../src/motion/ribbon';

// The light ribbon's maths (src/motion/ribbon.ts).
describe('light ribbon', () => {
  const card = (x: number, y: number, h = 400) => ({ x, y, w: 300, h });

  it('groups cards into rows, each ribbon behind its row of cards, starting where the last row ended', () => {
    const rows = rowsOf([card(0, 0), card(320, 0, 420), card(640, 0), card(0, 456), card(320, 456)]);
    expect(rows).toEqual([
      { x: 0, y: 0, w: 940, h: 420, start: 0 }, // as tall as the tallest card
      { x: 0, y: 456, w: 620, h: 400, start: 940 },
    ]);
    expect(rowsOf([card(0, 0), card(320, 3)])).toHaveLength(1); // sub-pixel offsets stay in the row
  });

  it('draws the rows in order as the length grows', () => {
    const [a, b] = rowsOf([card(0, 0), card(320, 0), card(0, 456)]);
    expect([drawnIn(a!, 0), drawnIn(b!, 0)]).toEqual([0, 0]);
    expect(drawnIn(a!, 310)).toBeCloseTo(0.5);
    expect([drawnIn(a!, 620), drawnIn(b!, 620)]).toEqual([1, 0]);
    expect(drawnIn(b!, 770)).toBeCloseTo(0.5);
    expect(drawnIn(b!, 5000)).toBe(1);
  });

  it('strands span the row and stay inside the cards’ height, crossing where the ribbon twists', () => {
    const h = 460;
    const ds = strands(2000, h);
    expect(ds).toHaveLength(22);
    const ys = (d: string) => [...d.matchAll(/[ML][\d.]+ ([\d.-]+)/g)].map((m) => Number(m[1]));
    for (const d of ds) {
      expect(d.startsWith('M0 ')).toBe(true);
      expect(d).toMatch(/L2000 [\d.]+$/);
      expect(Math.min(...ys(d))).toBeGreaterThanOrEqual(0);
      expect(Math.max(...ys(d))).toBeLessThanOrEqual(h);
    }
    // The outer strands swap sides somewhere along the row: the twist.
    const first = ys(ds[0]!), last = ys(ds.at(-1)!);
    const above = first.map((y, i) => y < last[i]!);
    expect(above).toContain(true);
    expect(above).toContain(false);
    expect(mid(0, h)).toBeGreaterThan(h * 0.4);
  });

  it('runs steel blue to bronze across the ribbon, a warm white core in the middle', () => {
    expect(colourAt(0)).toBe('#5b7fc4');
    expect(colourAt(0.5)).toBe('#fff3d6');
    expect(colourAt(1)).toBe('#a87b32');
  });
});
