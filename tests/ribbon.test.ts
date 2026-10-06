import { describe, expect, it } from 'vitest';
import { BAND, DROP, colourAt, drawnIn, mid, rowsOf, strands } from '../src/motion/ribbon';

// The light ribbon's maths (src/motion/ribbon.ts).
describe('light ribbon', () => {
  const card = (x: number, y: number) => ({ x, y, w: 300, h: 400 });

  it('groups cards into rows, each ribbon spanning its row and starting where the last row ended', () => {
    const rows = rowsOf([card(0, 0), card(320, 0), card(640, 0), card(0, 456), card(320, 456)]);
    expect(rows).toEqual([
      { x: 0, y: 400 + DROP - BAND / 2, w: 940, start: 0 },
      { x: 0, y: 856 + DROP - BAND / 2, w: 620, start: 940 },
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

  it('strands span the row and stay inside the band', () => {
    const ds = strands(1000);
    expect(ds).toHaveLength(15);
    for (const d of ds) {
      expect(d.startsWith('M0 ')).toBe(true);
      expect(d).toMatch(/L1000 [\d.]+$/);
      const ys = [...d.matchAll(/[ML][\d.]+ ([\d.-]+)/g)].map((m) => Number(m[1]));
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...ys)).toBeLessThanOrEqual(BAND);
    }
    expect(mid(0)).toBeGreaterThan(BAND / 2 - 5);
  });

  it('runs steel blue to bronze across the ribbon, a warm white core in the middle', () => {
    expect(colourAt(0)).toBe('#5b7fc4');
    expect(colourAt(0.5)).toBe('#fff3d6');
    expect(colourAt(1)).toBe('#a87b32');
  });
});
