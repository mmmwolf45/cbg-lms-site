import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import images from '../src/images.json';

// Largest AVIF per image, in KB (SPEC section 8, T10). Optional ones are built only once their photo exists.
const OPTIONAL: Record<string, number> = {
  'course-iosh': 60, 'course-qs': 60, 'course-mep': 60, 'course-structural': 60, 'course-bim': 60, 'course-interior': 60,
  'band-classroom': 150,
  'band-desk': 260,
  'qs-hero-poster': 180, 'qs-xray-concrete': 200, 'qs-xray-steel': 200, 'hazard-worksite-safe': 250,
};
// QS learner photos: one student-<slug> per .jpg in brand/assets/students.
const STUDENTS = 'brand/assets/students';
const students = existsSync(STUDENTS) ? readdirSync(STUDENTS).filter((f) => f.endsWith('.jpg')) : [];
const BUDGET: Record<string, number> = {
  ...OPTIONAL,
  'hero-explode-poster': 80,
  'hazard-worksite': 250,
  'closing-plate': 150,
  'trainer-ali-orkkatteri': 20,
  'trainer-elman-aloysius': 20,
  'trainer-ramshad-kk': 20,
  ...Object.fromEntries(['shafeer-p-p', 'jubair-kv', 'rinsha-v', 'nidha-fazli', 'swapna-saji', 'mini-pramod',
    'shuhaida-shamsudin', 'nadira-farhath', 'reenu-cherian', 'maneesh-vs'].map((s) => [`trainer-${s}`, 20])),
  ...Object.fromEntries(students.map((f) => [`student-${f.replace('.jpg', '')}`, 12])),
};

type Entry = (typeof images)[keyof typeof images];
const entries = Object.entries(images) as [string, Entry][];

describe('image manifest (T10)', () => {
  it('lists every required image, and nothing without a budget', () => {
    const names = Object.keys(images);
    expect(Object.keys(BUDGET).filter((n) => !(n in OPTIONAL) && !names.includes(n))).toEqual([]);
    expect(names.filter((n) => !(n in BUDGET))).toEqual([]);
  });

  it('builds the hero poster square, at the frame sizes', () => {
    const p = images['hero-explode-poster'];
    expect([p.width, p.height]).toEqual([960, 960]);
    expect(p.variants.avif.map((v) => v.w)).toEqual([960, 640]);
  });

  it('builds a square avatar for every learner photo, at one width of at most 80', () => {
    expect(students.length).toBeGreaterThan(0);
    for (const f of students) {
      const s = images[`student-${f.replace('.jpg', '')}` as keyof typeof images];
      expect(s.width).toBe(s.height);
      expect(s.variants.webp.map((v) => v.w)).toEqual([s.width]);
      expect(s.width).toBeLessThanOrEqual(80);
    }
  });

  it.each(entries)('%s has avif, webp and jpg at the same widths, files on disk', (_, e) => {
    const widths = e.variants.avif.map((v) => v.w);
    expect(widths[0]).toBe(e.width);
    for (const list of [e.variants.avif, e.variants.webp, e.variants.jpg]) {
      expect(list.map((v) => v.w)).toEqual(widths);
      for (const v of list) {
        expect(existsSync(`public/${v.file}`), v.file).toBe(true);
        expect(statSync(`public/${v.file}`).size).toBe(v.bytes);
      }
    }
  });

  it.each(entries)('%s AVIF is within budget', (name, e) => {
    for (const v of e.variants.avif)
      expect(statSync(`public/${v.file}`).size, v.file).toBeLessThanOrEqual(BUDGET[name] * 1024);
  });
});

// The exploding-building hero's frames (scripts/explode-frames.ts, SPEC section 5.1.1).
import { FRAMES, OUT, SIZES, frameName } from '../scripts/explode-frames';

describe('hero explode frames', () => {
  for (const [dir, s] of Object.entries(SIZES)) {
    it(`${dir}: all ${FRAMES} frames exist, within ${s.budgetKB} KB in all`, () => {
      let bytes = 0;
      for (let i = 0; i < FRAMES; i++) {
        const file = `${OUT}/${dir}/${frameName(i)}`;
        expect(existsSync(file), file).toBe(true);
        bytes += statSync(file).size;
      }
      expect(bytes).toBeLessThanOrEqual(s.budgetKB * 1024);
    });
  }
});
