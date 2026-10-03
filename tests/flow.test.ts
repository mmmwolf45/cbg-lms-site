import { describe, expect, it } from 'vitest';
import { FRAG, SCALE, canvasSize, glide } from '../src/motion/flow';

describe('flow background', () => {
  it('draws at about a third of the screen size, never tiny', () => {
    expect(SCALE).toBeLessThanOrEqual(0.5);
    expect(canvasSize(390, 844)).toEqual([133, 287]); // an iPhone: about 38,000 pixels
    expect(canvasSize(1440, 900)).toEqual([490, 306]);
    expect(canvasSize(100, 50)).toEqual([64, 64]);
  });

  it('glides toward the scroll position and lands exactly', () => {
    let shown = 0;
    const steps: number[] = [];
    for (let i = 0; i < 200 && shown !== 1; i++) steps.push((shown = glide(shown, 1)));
    expect(shown).toBe(1);
    expect(steps.length).toBeLessThan(100); // settles in well under 2 seconds at 60 fps
    expect(steps.every((v, i) => i === 0 || v >= steps[i - 1]!)).toBe(true); // never overshoots back
    expect(glide(0.5, 0.5)).toBe(0.5);
  });

  it('keeps the shader in the brand navy family with the capped highlight', () => {
    expect(FRAG).toContain('NAVY = vec3(.031, .071, .149)'); // #081226
    expect(FRAG).toContain('COBALT = vec3(.052, .118, .265)'); // capped for 4.5:1 muted text
  });
});
