import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { HAZARD_PHOTO, loadCourses, validateCourse } from '../content/schema';
import { courseTop } from '../templates/course';
import { pct } from '../templates/sections/course-hero';
import { nextStep, tipPlace, zoomFor } from '../src/motion/hazard-scan';
import images from '../src/images.json';

const course = loadCourses()[0];
const hazards = course.hero.hazards;

describe('hazard content (T22)', () => {
  it('has the six trainer-approved labels and explanations, word for word', () => {
    const md = readFileSync('docs/hazard-labels.md', 'utf8');
    const rows = [...md.matchAll(/^\| (\d) \| [^|]+\| ([^|]+) \| ([^|]+) \| OK \|$/gm)].map((m) => ({ label: m[2].trim(), detail: m[3].trim() }));
    const points = [...md.matchAll(/^\| (\d) \| ([\d, ]+) \| ([\d, ]+) \|$/gm)].map((m) => ({
      at: m[2].split(',').map(Number), zoom: m[3].split(',').map(Number),
    }));
    expect(rows).toHaveLength(6);
    expect(hazards).toEqual(rows.map((r, i) => ({ ...r, ...points[i] })));
  });

  it('matches the photo size and rejects points outside it', () => {
    const img = images['hazard-worksite'];
    expect([img.width, img.height]).toEqual([...HAZARD_PHOTO]);
    const bad = JSON.parse(JSON.stringify(course));
    bad.hero.hazards[2].at = [1600, 10];
    expect(() => validateCourse(bad)).toThrow('hero.hazards[2].at');
    bad.hero.hazards[2].at = [10, 10];
    bad.hero.hazards[2].zoom = [1400, 0, 200, 100];
    expect(() => validateCourse(bad)).toThrow('hero.hazards[2].zoom');
  });
});

describe('hazard markers in the template', () => {
  const top = courseTop(course);
  const dots = [...top.matchAll(/<button type="button" class="cbg-hazard-dot[^"]*"[^>]*>/g)].map((m) => m[0]);

  it('renders one marker per hazard, named by its label and described by its list item', () => {
    expect(dots).toHaveLength(6);
    hazards.forEach((z, i) => {
      expect(dots[i]).toContain(`aria-describedby="cbg-hazard-${i + 1}"`);
      expect(top).toContain(`<li id="cbg-hazard-${i + 1}"><strong>${z.label}</strong> <span>${z.detail}</span></li>`);
    });
    expect(top).toContain('<span>Open edge, no guardrail</span></button>');
  });

  it('places markers in % of the photo', () => {
    expect(pct(346, 1536)).toBe(22.53);
    expect(pct(140, 1024)).toBe(13.67);
    expect(dots[0]).toContain('style="--x:22.53%;--y:13.67%"');
    expect(dots[5]).toContain('style="--x:90.17%;--y:54.69%"');
    expect(dots[0]).toContain('data-cbg-zoom="13.02 3.91 24.74 25.39"');
    // Markers on the right third put their label chip on the left.
    expect(dots.map((d) => d.includes('cbg-hazard-dot--l'))).toEqual([false, true, false, false, false, true]);
  });
});

describe('zoomFor', () => {
  it('fits the area, centred on it', () => {
    const z = zoomFor([25, 25, 50, 50]);
    expect(z).toEqual({ s: 2, x: -50, y: -50 });
  });
  it('keeps the photo edges inside the box', () => {
    // Area in the bottom-right corner: translate stops at 100 - 100 * s.
    expect(zoomFor([80, 80, 20, 20])).toEqual({ s: 4, x: -300, y: -300 });
    expect(zoomFor([0, 0, 25, 25])).toEqual({ s: 4, x: 0, y: 0 });
  });
  it('fits the limiting side and caps the scale at 4', () => {
    const tall = zoomFor([40, 0, 10, 50]);
    expect(tall.s).toBe(2);
    expect(zoomFor([50, 50, 5, 5]).s).toBe(4);
    expect(zoomFor([0, 0, 100, 100])).toEqual({ s: 1, x: 0, y: 0 });
  });
  it('maps the area centre to the box centre for a real hazard', () => {
    const [x, y, w, h] = [430, 600, 760, 200];
    const z = zoomFor([pct(x, 1536), pct(y, 1024), pct(w, 1536), pct(h, 1024)]);
    const cx = z.x + z.s * pct(x + w / 2, 1536);
    expect(cx).toBeCloseTo(50, 0);
  });
});

describe('tipPlace', () => {
  it('sits right of the marker, centred on it vertically', () => {
    expect(tipPlace(100, 200, 240, 80, 800, 533)).toEqual({ left: false, x: 120, y: 160 });
  });
  it('flips left near the right edge', () => {
    expect(tipPlace(700, 200, 240, 80, 800, 533)).toEqual({ left: true, x: 440, y: 160 });
  });
  it('stays inside the box at the edges', () => {
    expect(tipPlace(100, 10, 240, 80, 800, 533).y).toBe(8);
    expect(tipPlace(100, 530, 240, 80, 800, 533).y).toBe(533 - 80 - 8);
    expect(tipPlace(300, 200, 280, 80, 360, 240)).toEqual({ left: true, x: 8, y: 152 });
  });
});

describe('nextStep', () => {
  it('runs whole photo, 1..n, whole photo, both ways', () => {
    const seq = [-1];
    for (let i = 0; i < 7; i++) seq.push(nextStep(seq.at(-1)!, 1, 6));
    expect(seq).toEqual([-1, 0, 1, 2, 3, 4, 5, -1]);
    expect(nextStep(-1, -1, 6)).toBe(5);
    expect(nextStep(0, -1, 6)).toBe(-1);
  });
});
