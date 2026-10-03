import { describe, expect, it } from 'vitest';
import { clamp01, frameDir, letterShift, loadOrder, progress, smooth, wordPose } from '../src/motion/explode';
import { words } from '../templates/sections/home-hero';

describe('exploding-building hero', () => {
  it('maps the pinned stretch to 0..1, clamped', () => {
    expect(progress(56, 56, 400)).toBe(0); // section top at the sticky top: the start
    expect(progress(-144, 56, 400)).toBe(0.5);
    expect(progress(-344, 56, 400)).toBe(1);
    expect(progress(500, 56, 400)).toBe(0); // not reached yet
    expect(progress(-2000, 56, 400)).toBe(1); // scrolled past
    expect(progress(0, 56, 0)).toBe(1); // no stretch (e.g. reduced motion): never divides by zero
  });

  it('eases and clamps', () => {
    expect([smooth(0), smooth(0.5), smooth(1)]).toEqual([0, 0.5, 1]);
    expect([clamp01(-1), clamp01(2)]).toEqual([0, 1]);
  });

  it('picks frames by the smaller screen side in device pixels (960px frames from 1100)', () => {
    expect(frameDir(390, 844, 3)).toBe('l'); // a 3x phone has the pixels for 960 (the approved prototype's rule)
    expect(frameDir(390, 664, 2)).toBe('s');
    expect(frameDir(360, 640, 1.5)).toBe('s');
    expect(frameDir(1440, 900, 1)).toBe('s'); // 900 css px at 1x: 640 frames are sharp enough
    expect(frameDir(1440, 900, 1.5)).toBe('l');
  });

  it('loads frame 0 first, then a coarse pass, and every frame exactly once', () => {
    const order = loadOrder(48);
    expect(order.slice(0, 7)).toEqual([0, 8, 16, 24, 32, 40, 4]);
    expect([...order].sort((a, b) => a - b)).toEqual([...Array(48).keys()]);
  });

  it('holds the headline still at the start and opens it as the building explodes', () => {
    const still = wordPose(0, 0, 1, 0, 1, false);
    for (const v of [still.dx, still.dy, still.rot]) expect(Math.abs(v)).toBe(0);
    expect(still.scale).toBe(1);
    const top = wordPose(1, 0, 1, 0, 1, false), bottom = wordPose(1, 2, 1, 0, 1, true);
    expect(top.dy).toBeLessThan(0); // the first line rises
    expect(bottom.dy).toBeGreaterThan(0); // the last line drops
    expect(bottom.scale).toBeCloseTo(0.93); // "classroom" eases back a little, and nothing else changes on it
    const left = wordPose(1, 1, 1, 0, 3, false), right = wordPose(1, 1, 1, 2, 3, false);
    expect(left.dx).toBeLessThan(0);
    expect(right.dx).toBeGreaterThan(0); // words on a line drift apart
    expect(letterShift(0, 7, 1)).toBeLessThan(0);
    expect(letterShift(6, 7, 1)).toBeGreaterThan(0); // the letters open from the word's middle
    expect(letterShift(3, 7, 1)).toBe(0);
  });

  it('splits the headline into three fixed lines, tones by CBG', () => {
    const html = words('Welcome to your CBG classroom');
    const lines = html.split('</span></span><span class="cbg-explode__line">');
    expect(html.match(/cbg-explode__line/g)).toHaveLength(3);
    expect(lines[0]).toContain('cbg-w--white');
    expect(html).toMatch(/cbg-w--gold"><span class="cbg-l">C<\/span><span class="cbg-l">B<\/span><span class="cbg-l">G</);
    expect(html.match(/cbg-w--dim/g)).toHaveLength(1);
    expect(words('Hello <b> & you')).not.toContain('<b>'); // escaped
  });
});
