import { describe, expect, it } from 'vitest';
import { capStep, damp, frameDt } from '../src/motion/glide';
import { REACH, glow } from '../src/motion/strip';
import { GLIDE_IN_MS, MAX_TILT, startsUnderPointer, tiltX, tiltY } from '../src/motion/support';
import { stateAt } from '../src/motion/cursor';
import { MAX_FLICK, SPIN, facing, flick, lean } from '../src/motion/globe';

// The night-sky effects' maths (src/motion/glide.ts, strip.ts, support.ts, cursor.ts, globe.ts).
describe('glide: slow, frame-rate independent, capped', () => {
  it('two half frames cover what one whole frame does', () => {
    const one = damp(0.032, 0.6);
    const half = damp(0.016, 0.6);
    expect(1 - (1 - half) ** 2).toBeCloseTo(one, 10);
    expect(damp(0, 0.6)).toBe(0);
    expect(damp(0.016, 0.6)).toBeLessThan(0.03); // heavy: under 3% of the way per frame
  });

  it('caps a dropped frame at 50 ms and never runs backwards', () => {
    expect(frameDt(1000, 0)).toBe(0.05);
    expect(frameDt(1016, 1000)).toBeCloseTo(0.016);
    expect(frameDt(900, 1000)).toBe(0);
  });

  it('shortens a step to the speed cap, leaves a short one alone', () => {
    expect(capStep(3, 4, 10)).toBe(1);
    expect(capStep(30, 40, 10)).toBeCloseTo(0.2);
  });
});

describe('strip gold', () => {
  it('is full right under the cursor, gone at its reach, and smooth between', () => {
    expect(glow(0, 0)).toBe(1);
    expect(glow(REACH, 0)).toBe(0);
    expect(glow(REACH * 3, 0)).toBe(0);
    expect(glow(REACH / 2, 0)).toBeCloseTo(0.5);
    expect(glow(0, REACH / 1.4)).toBeCloseTo(0); // vertical distance counts 1.4x
  });
});

describe('support card', () => {
  it('tilts the side under the pointer away, 4deg / 5deg at most', () => {
    expect([tiltX(0.5), tiltY(0.5)]).toEqual([0, 0]);
    expect([tiltX(0), tiltY(1)]).toEqual([MAX_TILT.x, MAX_TILT.y]);
    expect(MAX_TILT.x).toBeLessThanOrEqual(4);
    expect(MAX_TILT.y).toBeLessThanOrEqual(5);
  });

  it('the spotlight glides over while it is still fading out, else starts under the pointer', () => {
    expect(startsUnderPointer(GLIDE_IN_MS / 2)).toBe(false);
    expect(startsUnderPointer(GLIDE_IN_MS + 1)).toBe(true);
  });
});

describe('cursor state', () => {
  const box = { left: 100, right: 300, top: 100, bottom: 160 };
  it('shows over a region\'s text (with a margin), rings over a link, hides elsewhere', () => {
    expect(stateAt(200, 130, false, null, false)).toBe('off');
    expect(stateAt(200, 130, true, box, false)).toBe('on');
    expect(stateAt(80, 130, true, box, false)).toBe('on'); // within 32px of the text
    expect(stateAt(20, 130, true, box, false)).toBe('off'); // the region's empty space
    expect(stateAt(200, 130, true, box, true)).toBe('link');
    expect(stateAt(5, 5, true, null, false)).toBe('on'); // the strip counts whole
  });
});

describe('globe', () => {
  it('turns once every 75 s, a flick adds at most MAX_FLICK either way', () => {
    expect(SPIN * 75).toBeCloseTo(Math.PI * 2);
    expect(flick(5)).toBe(MAX_FLICK);
    expect(flick(-5)).toBe(-MAX_FLICK);
    expect(flick(0.2)).toBe(0.2);
  });

  it('brings a longitude to the front, a turn per 360 degrees', () => {
    expect(facing(90)).toBeCloseTo(Math.PI);
    expect(facing(0) - facing(90)).toBeCloseTo(Math.PI / 2);
  });

  it('leans toward the cursor, at most one unit, half a screen away', () => {
    expect(lean(0, 720)).toBe(0);
    expect(lean(360, 720)).toBe(0.5);
    expect(lean(-5000, 720)).toBe(-1);
  });
});
