import { describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import images from '../src/images.json';

// Largest AVIF per image, in KB (SPEC section 8, T10).
const BUDGET: Record<string, number> = {
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
  it('lists every expected image and nothing else', () =>
    expect(Object.keys(images).sort()).toEqual(Object.keys(BUDGET).sort()));

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
