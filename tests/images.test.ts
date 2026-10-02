import { describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import images from '../src/images.json';

// Largest AVIF per image, in KB (SPEC section 8, T10). Optional ones are built only once their photo exists.
const OPTIONAL: Record<string, number> = {
  'course-iosh': 60, 'course-qs': 60, 'course-mep': 60, 'course-structural': 60, 'course-bim': 60, 'course-interior': 60,
  'band-classroom': 150,
};
const BUDGET: Record<string, number> = {
  ...OPTIONAL,
  'hero-structure': 250,
  'hero-structure-phone': 120,
  'hazard-worksite': 250,
  'closing-plate': 150,
  'trainer-ali-orkkatteri': 20,
  'trainer-elman-aloysius': 20,
  'trainer-ramshad-kk': 20,
};

type Entry = (typeof images)[keyof typeof images];
const entries = Object.entries(images) as [string, Entry][];

describe('image manifest (T10)', () => {
  it('lists every required image, and nothing without a budget', () => {
    const names = Object.keys(images);
    expect(Object.keys(BUDGET).filter((n) => !(n in OPTIONAL) && !names.includes(n))).toEqual([]);
    expect(names.filter((n) => !(n in BUDGET))).toEqual([]);
  });

  it('records the phone crop in source px', () =>
    expect(images['hero-structure-phone'].crop).toEqual({ left: 171, top: 0, width: 1365, height: 1024 }));

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
