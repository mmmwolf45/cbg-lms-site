import { describe, expect, it } from 'vitest';
import { loadCourses, validateCourse, type Course } from '../content/schema';
import { barPaths, clampA, ends, momentAt, PEAK, readout, shearLeft, TYPES, weightsOf } from '../src/motion/beam-model';
import { step } from '../src/motion/beam';
import { partial } from '../src/motion/scrub';
import { beam } from '../templates/sections/course-beam';
import { courseMain, courseTop } from '../templates/course';

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('beam model: textbook results for a point load P = 1 on a span L = 1', () => {
  const W = { simple: weightsOf('simple'), fixed: weightsOf('fixed'), cantilever: weightsOf('cantilever') };
  it('simply supported, load at midspan: M = PL/4 under the load, zero at the supports', () => {
    close(momentAt(W.simple, 0.5, 0.5), 0.25);
    close(momentAt(W.simple, 0.5, 0), 0);
    close(momentAt(W.simple, 0.5, 1), 0);
  });
  it('fixed both ends, load at midspan: -PL/8 at each support, +PL/8 under the load', () => {
    close(momentAt(W.fixed, 0.5, 0), -0.125);
    close(momentAt(W.fixed, 0.5, 1), -0.125);
    close(momentAt(W.fixed, 0.5, 0.5), 0.125);
  });
  it('fixed both ends, load at a: support moments -Pab²/L² and -Pa²b/L²', () => {
    const a = 0.3, b = 0.7;
    close(momentAt(W.fixed, a, 0), -a * b * b);
    close(momentAt(W.fixed, a, 1), -a * a * b);
  });
  it('cantilever, load at the tip: -PL at the wall, zero at the tip, shear P', () => {
    close(momentAt(W.cantilever, 1, 0), -1);
    close(momentAt(W.cantilever, 1, 1), 0);
    close(shearLeft(W.cantilever, 1), 1);
  });
  it('every left reaction lies between 0 and P', () => {
    for (const t of TYPES) for (const a of [0.2, 0.5, 0.8]) {
      const { RA } = ends(t, a);
      expect(RA).toBeGreaterThan(0);
      expect(RA).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
  it('PEAK is each type’s largest |M| over every load position', () => {
    TYPES.forEach((t, i) => {
      let max = 0;
      for (let k = 1; k < 100; k++) for (let j = 0; j <= 100; j++) max = Math.max(max, Math.abs(momentAt(weightsOf(t), k / 100, j / 100)));
      expect(max).toBeLessThanOrEqual(PEAK[i]! + 1e-3);
      expect(max).toBeGreaterThan(PEAK[i]! - 2e-2);
    });
  });
  it('a blend of supports is the weighted sum (so a change of supports glides)', () => {
    close(momentAt([0.5, 0.5, 0], 0.5, 0), 0.5 * -0.125);
  });
});

describe('beam steel: on the tension face', () => {
  it('simply supported: bottom bars only', () => {
    const [bottom, top] = barPaths(weightsOf('simple'), 0.5);
    expect(bottom).not.toBe('');
    expect(top).toBe('');
  });
  it('fixed both ends: top bars over both supports, bottom bars in the span', () => {
    const [bottom, top] = barPaths(weightsOf('fixed'), 0.5);
    expect(bottom.match(/M/g)).toHaveLength(1);
    expect(top.match(/M/g)).toHaveLength(2);
  });
  it('cantilever: top bars only', () => {
    const [bottom, top] = barPaths(weightsOf('cantilever'), 0.7);
    expect(bottom).toBe('');
    expect(top).not.toBe('');
  });
});

describe('beam readout (100 kN on 6 m)', () => {
  it('simply supported at midspan: 150 kN·m sagging, 50 kN shear', () => {
    expect(readout('simple', 0.5, 100, 6)).toEqual({ sag: 150, hog: 0, shear: 50 });
  });
  it('fixed at midspan: 75 kN·m each way', () => {
    expect(readout('fixed', 0.5, 100, 6)).toEqual({ sag: 75, hog: 75, shear: 50 });
  });
  it('cantilever at the tip: 600 kN·m hogging, 100 kN shear', () => {
    expect(readout('cantilever', 1, 100, 6)).toEqual({ sag: 0, hog: 600, shear: 100 });
  });
  it('the load stays between the supports, or anywhere up to a cantilever’s tip', () => {
    expect(clampA('simple', 1)).toBe(0.92);
    expect(clampA('cantilever', 1)).toBe(1);
    expect(clampA('fixed', -1)).toBe(0.08);
  });
});

describe('beam glide', () => {
  it('moves part of the way each frame and never overshoots', () => {
    expect(step(16)).toBeGreaterThan(0);
    expect(step(16)).toBeLessThan(0.1);
    expect(step(10_000)).toBeLessThanOrEqual(1);
  });
  it('reduced motion (tau 0) is instant', () => expect(step(16, 0)).toBe(1));
});

describe('load path (hero scrub)', () => {
  const line = [0, 0, 10, 0, 10, 10];
  it('draws nothing past the start at t = 0, all of it at t = 1', () => {
    expect(partial(line, 0)).toEqual([0, 0]);
    expect(partial(line, 1)).toEqual([0, 0, 10, 0, 10, 10]);
  });
  it('stops part way along a segment', () => {
    expect(partial(line, 0.75)).toEqual([0, 0, 10, 0, 10, 5]);
  });
});

describe('the Structural course page', () => {
  const sd = loadCourses().find((c) => c.slug === 'structural-design')!;
  it('is a live course 103 with the load-path hero, the beam and the ground X-ray', () => {
    expect(sd.uniqueId).toBe('103');
    expect(sd.card.status).toBe('live now');
    expect(sd.hero.scrub?.path?.lines.length).toBeGreaterThan(0);
    expect(sd.beam).toBeDefined();
    expect(sd.xray?.labels.every((l) => l.side)).toBe(true);
  });
  it('renders the beam after the units and before the X-ray, with its controls hidden until the script runs', () => {
    const html = courseMain(sd);
    expect(html.indexOf('id="cbg-units"')).toBeLessThan(html.indexOf('id="cbg-beam"'));
    expect(html.indexOf('id="cbg-beam"')).toBeLessThan(html.indexOf('id="cbg-xray"'));
    expect(html).toContain('class="cbg-bmd__types" role="group" aria-label="Supports" hidden');
    expect(html).toContain('aria-label="Ground scan: move to see the foundations"');
  });
  it('the static beam reads the midspan figures', () => {
    const html = beam(sd.beam!);
    expect(html).toContain('<dd data-cbg-read="sag">150 kN·m</dd>');
    expect(html).toContain('<dd data-cbg-read="shear">50 kN</dd>');
  });
  it('the hero carries the load path for the script', () => {
    expect(courseTop(sd)).toContain('data-cbg-path="{&quot;from&quot;:0.55');
  });
  it('refuses a load path outside the frame and a beam with no load', () => {
    const bad = { ...sd, hero: { ...sd.hero, scrub: { ...sd.hero.scrub!, path: { from: 0.55, lines: [[0, 0, 1700, 0]] } } } } as Course;
    expect(() => validateCourse(bad, 'sd')).toThrow('scrub.path.lines[0]');
    const noLoad = { ...sd, beam: { ...sd.beam!, load: 0 } } as Course;
    expect(() => validateCourse(noLoad, 'sd')).toThrow('beam: load and span');
  });
});
