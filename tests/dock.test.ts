import { describe, expect, it } from 'vitest';
import { morph, shrinkAt } from '../src/motion/dock';

// The support card's shrink into the dock (src/motion/dock.ts).
describe('support dock', () => {
  const card = { x: 140, y: 200, w: 1160, h: 520 };
  const dock = { x: 16, y: 820, w: 176, h: 64 };

  it('starts as the card and ends on the dock, the dock size by area', () => {
    const start = morph(card, dock, 0);
    expect([start.x + 0, start.y + 0, start.s]).toEqual([0, 0, 1]);
    const end = morph(card, dock, 1);
    expect(end.x).toBeCloseTo(16 + 88 - (140 + 580));
    expect(end.y).toBeCloseTo(820 + 32 - (200 + 260));
    expect(end.s * end.s * card.w * card.h).toBeCloseTo(dock.w * dock.h);
  });

  it('shrinks in place first, then glides, never growing or turning back', () => {
    expect(morph(card, dock, 0.2).x + 0).toBe(0); // still in place
    expect(morph(card, dock, 0.2).s).toBeLessThan(1);
    let prev = morph(card, dock, 0);
    for (let e = 0.05; e <= 1.0001; e += 0.05) {
      const now = morph(card, dock, e);
      expect(now.s).toBeLessThanOrEqual(prev.s);
      expect(now.x).toBeLessThanOrEqual(prev.x); // the dock is to the left and below
      expect(now.y).toBeGreaterThanOrEqual(prev.y);
      prev = now;
    }
  });

  it('follows the scroll through the stretch only', () => {
    expect(shrinkAt(900, 1000, 400)).toBe(0);
    expect(shrinkAt(1200, 1000, 400)).toBe(0.5);
    expect(shrinkAt(5000, 1000, 400)).toBe(1);
  });
});
