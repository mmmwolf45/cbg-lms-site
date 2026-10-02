import { describe, expect, it } from 'vitest';
import { delta, fanPoses, stackOffsets, type Box } from '../src/motion/course-extras';

// The laptop grid (792px column): the featured card spans both columns, then 2 x 2 cards.
const grid: Box[] = [
  { x: 0, y: 0, w: 792, h: 264 },
  { x: 0, y: 280, w: 388, h: 345 },
  { x: 404, y: 280, w: 388, h: 345 },
  { x: 0, y: 641, w: 388, h: 284 },
  { x: 404, y: 641, w: 388, h: 284 },
];

// Where a card's bottom-centre (its transform origin) ends up after the pose's translate.
const pivotOf = (b: Box, p: { x: number; y: number }) => [b.x + b.w / 2 + p.x, b.y + b.h + p.y];

describe('delta (FLIP)', () => {
  it('moves the bottom-centre of a box onto the point', () => {
    expect(delta({ x: 100, y: 50, w: 200, h: 100 }, 0, 0)).toEqual({ x: -200, y: -150 });
    expect(delta({ x: 0, y: 0, w: 40, h: 40 }, 20, 40)).toEqual({ x: 0, y: 0 });
  });

  it('is undone by translating back (the deal ends at identity)', () => {
    const b = { x: 404, y: 641, w: 388, h: 284 };
    const d = delta(b, 210, 230);
    expect(pivotOf(b, d)).toEqual([210, 230]);
  });
});

describe('fanPoses', () => {
  const poses = fanPoses(grid);

  it('gives one pose per card', () => {
    expect(poses).toHaveLength(5);
    expect(fanPoses(grid.slice(0, 2))).toHaveLength(2);
  });

  it('gathers every card near the top-left of the grid, pivots a few px apart', () => {
    const pivots = grid.map((b, i) => pivotOf(b, poses[i]!));
    for (const [, y] of pivots) expect(y).toBeCloseTo(pivots[0]![1]!, 6); // one shared baseline
    for (const [x] of pivots) expect(x).toBeLessThan(792 / 2);
    expect(pivots[0]![1]).toBeLessThan(grid[1]!.h); // the hand sits within the top of the grid
  });

  it('keeps the top card nearly upright and tilts the rest alternately, more the deeper they sit', () => {
    expect(Math.abs(poses[0]!.rotation)).toBeLessThanOrEqual(3);
    const rest = poses.slice(1).map((p) => p.rotation);
    rest.forEach((r, i) => {
      if (i) expect(Math.sign(r)).toBe(-Math.sign(rest[i - 1]!));
      if (i) expect(Math.abs(r)).toBeGreaterThan(Math.abs(rest[i - 1]!));
    });
    expect(Math.max(...poses.map((p) => Math.abs(p.rotation)))).toBeLessThanOrEqual(20);
  });

  it('shrinks the cards, the wide featured card most, so the hand reads as cards of one size', () => {
    for (const p of poses) expect(p.scale).toBeGreaterThan(0.2), expect(p.scale).toBeLessThanOrEqual(0.7);
    expect(poses[0]!.scale).toBeLessThan(poses[1]!.scale);
    expect(792 * poses[0]!.scale).toBeLessThanOrEqual(1.25 * 388 * poses[1]!.scale + 1e-9);
  });

  it('works for any number of equal cards', () => {
    const cards = Array.from({ length: 3 }, (_, i): Box => ({ x: (i % 2) * 300, y: Math.floor(i / 2) * 400, w: 280, h: 380 }));
    const p = fanPoses(cards, 0.5);
    expect(p.every((q) => q.scale === 0.5)).toBe(true);
    expect(p.map((q) => q.rotation)).toEqual([-2, 6, -10]);
  });
});

describe('stackOffsets', () => {
  it('slides every cover onto the first, each a step further right', () => {
    expect(stackOffsets([0, 168, 252, 336])).toEqual([0, -165, -246, -327]);
    expect(stackOffsets([10, 110], 0)).toEqual([0, -100]);
    expect(stackOffsets([])).toEqual([]);
  });
});
