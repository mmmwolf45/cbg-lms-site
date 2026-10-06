import { describe, expect, it } from 'vitest';
import { WAVES, glide } from '../src/motion/flow';

describe('flow background', () => {
  it('glides toward the scroll position and lands exactly', () => {
    let shown = 0;
    const steps: number[] = [];
    for (let i = 0; i < 200 && shown !== 1; i++) steps.push((shown = glide(shown, 1, 1 / 60)));
    expect(shown).toBe(1);
    expect(steps.length).toBeLessThan(100); // settles in well under 2 seconds at 60 fps
    expect(steps.every((v, i) => i === 0 || v >= steps[i - 1]!)).toBe(true); // never overshoots back
    expect(glide(0.5, 0.5, 1 / 60)).toBe(0.5);
    // Frame-rate independent: 30 draws a second (the sky canvas's cap) reach where 60 do.
    let a = 0, b = 0;
    for (let i = 0; i < 30; i++) a = glide(a, 1, 1 / 60);
    for (let i = 0; i < 15; i++) b = glide(b, 1, 1 / 30);
    expect(b).toBeCloseTo(a, 6);
  });

  it('keeps the shader in the brand navy family with the capped highlight', () => {
    expect(WAVES).toContain('NAVY = vec3(.031, .071, .149)'); // #081226
    expect(WAVES).toContain('COBALT = vec3(.052, .118, .265)'); // capped for 4.5:1 muted text
  });
});
