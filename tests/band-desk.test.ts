import { describe, expect, it } from 'vitest';
import { SPIN_MS, TAU, glide, influence, pose, spinAngle } from '../src/motion/band-desk';

describe('floating desk', () => {
  it('pulls hardest right over an object and fades smoothly to nothing at its reach', () => {
    expect(influence(0, 0)).toBe(1);
    expect(influence(0.5, 0)).toBeCloseTo(0.5);
    expect(influence(1, 0)).toBe(0);
    expect(influence(0.6, 0.9)).toBe(0); // beyond the reach
    expect(influence(0.2, 0)).toBeGreaterThan(influence(0.4, 0));
  });

  it('lifts the object and leans it away from the hand, never past its limits', () => {
    const right = pose(1, 0.3, 0, 1), left = pose(1, -0.3, 0, 1);
    expect(right.lift).toBe(26);
    expect(right.x).toBeGreaterThan(0); // the hand is to its left: it drifts right
    expect(left.x).toBeLessThan(0);
    expect(Math.abs(pose(1, 5, -5, 1).ry)).toBeLessThanOrEqual(24);
    expect(Math.abs(pose(1, 5, -5, 1).rx)).toBeLessThanOrEqual(9);
    for (const v of Object.values(pose(0, 0.3, 0.3, 1))) expect(Math.abs(v)).toBe(0); // out of reach: at rest
  });

  it('glides without overshoot, at the same pace at any frame rate', () => {
    let v = 0;
    const seen: number[] = [];
    for (let t = 0; t < 2000; t += 16) seen.push((v += (1 - v) * glide(16)));
    expect(seen.every((x, i) => x <= 1 && (i === 0 || x >= seen[i - 1]!))).toBe(true); // rises, never past the goal
    // 60 Hz and 120 Hz reach the same point after the same time.
    let a = 0, b = 0;
    for (let i = 0; i < 15; i++) a += (1 - a) * glide(16);
    for (let i = 0; i < 30; i++) b += (1 - b) * glide(8);
    expect(a).toBeCloseTo(b, 2);
    expect(TAU).toBeGreaterThanOrEqual(200); // smooth, not snappy
  });

  it('turns once on a tap, easing in and out', () => {
    expect(spinAngle(0)).toBe(0);
    expect(spinAngle(0.5)).toBe(180);
    expect(spinAngle(1)).toBe(360);
    expect(spinAngle(0.1)).toBeLessThan(36); // slow start
    expect(SPIN_MS).toBeGreaterThanOrEqual(1000);
  });
});
