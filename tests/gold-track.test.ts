import { describe, expect, it } from 'vitest';
import { lengthAt, shareOf, waveParts } from '../src/motion/gold-track';

// The gold track's maths (src/motion/gold-track.ts).
describe('gold track', () => {
  const lens = [0, 300, 600, 1000];

  it('reaches node i when the row is i/(n-1) through, between nodes in proportion', () => {
    expect(lengthAt(lens, 0)).toBe(0);
    expect(lengthAt(lens, 1 / 3)).toBeCloseTo(300);
    expect(lengthAt(lens, 1)).toBe(1000);
    expect(lengthAt(lens, 5 / 6)).toBeCloseTo(800);
    expect(lengthAt(lens, -1)).toBe(0);
    expect(lengthAt(lens, 2)).toBe(1000);
    expect(lengthAt([], 0.5)).toBe(0);
  });

  it('shareOf undoes lengthAt, so a resize keeps the same nodes lit', () => {
    for (const p of [0, 0.1, 1 / 3, 0.5, 0.9, 1]) expect(shareOf(lens, lengthAt(lens, p))).toBeCloseTo(p);
    expect(shareOf([0], 0)).toBe(0);
  });

  it('waves along a row and starts a new row with a move', () => {
    const parts = waveParts([{ x: 0, y: 10 }, { x: 100, y: 10 }, { x: 200, y: 10 }, { x: 0, y: 300 }, { x: 100, y: 300 }]);
    expect(parts.map((p) => p[0])).toEqual(['M', 'C', 'C', 'M', 'C']);
    expect(parts[1]).toBe('C40 16 60 16 100 10'); // sags down, then up
    expect(parts[2]).toBe('C140 4 160 4 200 10');
    expect(parts[4]).toBe('C40 306 60 306 100 300'); // each row starts the same way
  });
});
