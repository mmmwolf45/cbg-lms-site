import { describe, expect, it } from 'vitest';
import images from '../src/images.json';
import { PATHS, PHONE_CROP, SOURCE, type Group } from '../src/motion/blueprint-paths';
import {
  EACH, FULL_BOX, GROUPS, LIGHT_AT, LIGHT_DUR, PHONE_BOX, TIMING, coverScale, startAt, viewBoxFor,
} from '../src/motion/blueprint';

const PAGES = 'https://mmmwolf45.github.io/cbg-lms-site/img/';

describe('viewBox follows the photo the <img> shows', () => {
  it('laptop sources show the full frame', () => {
    expect(viewBoxFor(`${PAGES}hero-structure-1536.avif`, false)).toEqual([0, 0, 1536, 1024]);
    expect(viewBoxFor(`${PAGES}hero-structure-1024.jpg`, true)).toEqual(FULL_BOX); // the source wins over the query
  });

  it('phone sources show the phone crop of the same frame', () => {
    expect(viewBoxFor(`${PAGES}hero-structure-phone-900.avif`, false)).toEqual([171, 0, 1365, 1024]);
    expect(viewBoxFor(`${PAGES}hero-structure-phone-600.webp`, true)).toEqual(PHONE_BOX);
  });

  it('before a source is picked, the art-direction query decides', () => {
    expect(viewBoxFor('', true)).toEqual(PHONE_BOX);
    expect(viewBoxFor('', false)).toEqual(FULL_BOX);
  });

  it('matches the image pipeline: full source size and the phone crop rect', () => {
    expect([SOURCE.w, SOURCE.h]).toEqual([images['hero-structure'].width, images['hero-structure'].height]);
    expect(PHONE_CROP).toEqual({
      x: images['hero-structure-phone'].crop.left,
      y: images['hero-structure-phone'].crop.top,
      w: images['hero-structure-phone'].crop.width,
      h: images['hero-structure-phone'].crop.height,
    });
  });

  it('scales like object-fit: cover', () => {
    expect(coverScale(900, 600, FULL_BOX)).toBeCloseTo(900 / 1536); // same 3:2 shape
    expect(coverScale(390, 292.5, PHONE_BOX)).toBeCloseTo(390 / 1365); // 4:3 phone crop in a 4:3 box
    expect(coverScale(768, 512, PHONE_BOX)).toBeCloseTo(768 / 1365); // 4:3 crop in a 3:2 box: width fills
    expect(coverScale(300, 600, FULL_BOX)).toBeCloseTo(600 / 1024); // tall box: height fills
  });
});

describe('blueprint path data', () => {
  const all = GROUPS.flatMap((g) => PATHS[g].map((s) => ({ g, s })));

  it('has every group, with a sensible number of segments', () => {
    expect([...GROUPS].sort()).toEqual(['beam', 'brace', 'column', 'crane']);
    for (const g of GROUPS) expect(PATHS[g].length).toBeGreaterThan(0);
    expect(all.length).toBeGreaterThanOrEqual(45);
    expect(all.length).toBeLessThanOrEqual(90);
  });

  it('keeps every segment inside the source frame, in whole pixels, with real length', () => {
    for (const { s } of all) {
      const [x1, y1, x2, y2, order] = s;
      for (const x of [x1, x2]) expect(x >= 0 && x <= SOURCE.w).toBe(true);
      for (const y of [y1, y2]) expect(y >= 0 && y <= SOURCE.h).toBe(true);
      for (const v of s) expect(Number.isInteger(v)).toBe(true);
      expect(Math.hypot(x2 - x1, y2 - y1)).toBeGreaterThan(10);
      expect(order).toBeGreaterThanOrEqual(0);
    }
  });

  it('draws columns bottom up', () => {
    for (const [, y1, , y2] of PATHS.column) expect(y1).toBeGreaterThan(y2);
  });

  it('most of the frame sits inside the phone crop too', () => {
    const inCrop = all.filter(({ s: [x1, , x2] }) => Math.min(x1, x2) >= PHONE_CROP.x).length;
    expect(inCrop / all.length).toBeGreaterThan(0.95);
  });
});

describe('sequence', () => {
  const last = (g: Group) => Math.max(...PATHS[g].map((s) => s[4]));
  const end = (g: Group) => startAt(g, last(g)) + TIMING[g].dur + EACH * (PATHS[g].length - 1);

  it('columns, then beams floor by floor, then braces, crane last', () => {
    expect(startAt('column', 0)).toBe(0);
    expect(startAt('beam', 0)).toBeGreaterThan(startAt('column', 0));
    for (let o = 1; o <= last('beam'); o++) expect(startAt('beam', o)).toBeGreaterThan(startAt('beam', o - 1));
    expect(startAt('brace', 0)).toBeGreaterThan(startAt('beam', 3));
    expect(startAt('crane', 0)).toBeGreaterThan(startAt('brace', 0));
    expect(startAt('crane', last('crane'))).toBeGreaterThan(startAt('beam', last('beam')));
  });

  it('draws in about two seconds, then lights the photo in under a second', () => {
    const drawn = Math.max(...GROUPS.map((g) => startAt(g, last(g)) + TIMING[g].dur));
    expect(drawn).toBeGreaterThan(1.8);
    expect(drawn).toBeLessThan(2.6);
    expect(LIGHT_AT).toBeLessThanOrEqual(drawn);
    expect(LIGHT_DUR).toBeLessThanOrEqual(1);
    expect(LIGHT_AT + LIGHT_DUR).toBeLessThan(3.2);
    for (const g of GROUPS) expect(end(g)).toBeLessThan(LIGHT_AT + LIGHT_DUR);
  });
});
