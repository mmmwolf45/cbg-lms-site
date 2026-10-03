import { describe, expect, it } from 'vitest';
import { loadCourse, validateCourse, type Course } from '../content/schema';
import { courseTop } from '../templates/course';
import { currentRow, decimals, fmtQty, qtyAt, ROW_SPAN, rowT, scrubDir, totalShown } from '../src/motion/scrub';
import { pick, squareCrop } from '../scripts/scrub-frames';
import { PAGES } from '../src/components/html';

// The QS build-scrub hero (src/motion/scrub.ts, templates/sections/course-hero.ts, scripts/scrub-frames.ts).
// A fixture course: the IOSH page with its hero swapped for a build scrub (the real QS YAML is separate).
const iosh = loadCourse('iosh-level-3.yaml');
const scrub = {
  frames: 'qs-hero', count: 48, label: 'Example take-off', total: 'Shell and core: AED 1,240,000',
  takeoff: [
    { item: 'Excavation', qty: 412, unit: 'm³', at: 0.1 },
    { item: 'Concrete', qty: 186.5, unit: 'm³', at: 0.3 },
    { item: 'Blockwork', qty: 1240, unit: 'm²', at: 0.5 },
    { item: 'Reinforcement', qty: 18.25, unit: 't', at: 0.7 },
  ],
};
const fixture = (over: Partial<Course['hero']> = {}): Course => ({
  ...iosh,
  hero: { ...iosh.hero, visual: 'build-scrub', image: 'hazard-worksite', imageAlt: 'A finished villa at dusk', hazards: undefined, tour: undefined, scrub, ...over },
});
const ats = scrub.takeoff.map((r) => r.at);

describe('build scrub: timing', () => {
  it('counts each row over ROW_SPAN from its `at`, clamped', () => {
    expect(rowT(0.05, 0.1)).toBe(0);
    expect(rowT(0.1, 0.1)).toBe(0);
    expect(rowT(0.1 + ROW_SPAN / 2, 0.1)).toBeCloseTo(0.5);
    expect(rowT(0.9, 0.1)).toBe(1);
  });

  it('a row late in the scrub still reaches its full quantity at the end', () => {
    expect(rowT(1, 0.95)).toBe(1); // only 0.05 of scrub left: it counts over that
    expect(rowT(0.975, 0.95)).toBeCloseTo(0.5);
    expect(rowT(1, 1)).toBe(1);
    expect(rowT(0.99, 1)).toBe(0);
  });

  it('shows the total once the last row has counted, and always at the very end', () => {
    expect(totalShown(0.7 + ROW_SPAN - 0.01, ats)).toBe(false);
    expect(totalShown(0.7 + ROW_SPAN, ats)).toBe(true);
    expect(totalShown(1, [0.95])).toBe(true);
    expect(totalShown(0.99, [0.95])).toBe(false);
  });

  it('the phone strip shows the last row reached (the first before any)', () => {
    expect(currentRow(0, ats)).toBe(0);
    expect(currentRow(0.35, ats)).toBe(1);
    expect(currentRow(1, ats)).toBe(3);
  });

  it('formats quantities like the build does: separators, the YAML number’s own decimals', () => {
    expect(fmtQty(1240)).toBe('1,240');
    expect(fmtQty(1234567.891, 2)).toBe('1,234,567.89');
    expect(fmtQty(0, 1)).toBe('0.0');
    expect([decimals(18.25), decimals(186.5), decimals(412)]).toEqual([2, 1, 0]);
    expect(qtyAt(1240, 0)).toBe('0');
    expect(qtyAt(1240, 1)).toBe('1,240');
    expect(qtyAt(18.25, 1)).toBe('18.25');
    expect(Number(qtyAt(1000, 0.5).replace(',', ''))).toBeGreaterThan(500); // ease-out: most of it early
  });

  it('phones in portrait take the square frames unless the screen has tablet pixels', () => {
    expect(scrubDir(390, 3, false)).toBe('s');
    expect(scrubDir(768, 2, false)).toBe('l');
    expect(scrubDir(1280, 1, true)).toBe('l');
    expect(scrubDir(844, 3, true)).toBe('l'); // a phone on its side shows the wide layout
  });
});

describe('build scrub: frames script', () => {
  it('picks evenly spaced frames, first and last included', () => {
    expect(pick(91, 48)[0]).toBe(0);
    expect(pick(91, 48)[47]).toBe(90);
    expect(new Set(pick(91, 48)).size).toBe(48);
    expect(() => pick(30, 48)).toThrow('fewer than the 48');
  });

  it('crops the phone square around the centre, inside the frame', () => {
    expect(squareCrop(1920, 1080, 0.5)).toEqual({ left: 420, top: 0, width: 1080, height: 1080 });
    expect(squareCrop(1920, 1080, 0.95).left).toBe(840);
    expect(squareCrop(1920, 1080, 0).left).toBe(0);
  });
});

describe('build scrub: markup', () => {
  const top = courseTop(fixture());

  it('validates with the schema', () => {
    expect(() => validateCourse(fixture())).not.toThrow();
  });

  it('names the frames on the Pages base and the poster as the eager full-width image', () => {
    expect(top).toContain(`data-cbg-scrub="${PAGES}qs-hero/" data-cbg-frames="48"`);
    expect(top.match(/fetchpriority="high"/g)).toHaveLength(1);
    expect(top).toMatch(/<picture class="cbg-scrub__poster">[\s\S]*sizes="100vw"[\s\S]*alt="A finished villa at dusk" fetchpriority="high"/);
  });

  it('writes the whole take-off at final quantities (the static, reduced-motion state)', () => {
    const rows = [...top.matchAll(/<li class="cbg-takeoff__row" data-cbg-at="([\d.]+)">([\s\S]*?)<\/li>/g)];
    expect(rows.map((r) => Number(r[1]))).toEqual(ats);
    expect(rows[2]![2]).toContain('<b aria-hidden="true" data-cbg-qty="1240">1,240</b><span class="cbg-sr-only">1,240</span> m²');
    expect(rows[1]![2]).toContain('>186.5<');
    expect(top).toContain('<p class="cbg-takeoff__label">Example take-off</p>');
    expect(top).toContain('<p class="cbg-takeoff__total">Shell and core: AED 1,240,000</p>');
    // Not the generic counters (data-cbg-count): the scrub counts these itself.
    expect(top.slice(top.indexOf('<div class="cbg-takeoff">'), top.indexOf('<ul class="cbg-facts">'))).not.toContain('data-cbg-count');
  });

  it('leaves out the total line when there is none, and escapes copy', () => {
    const t = courseTop(fixture({ scrub: { ...scrub, total: undefined, takeoff: [{ item: 'Doors & <frames>', qty: 12, unit: 'nr', at: 0 }] } }));
    expect(t).not.toContain('cbg-takeoff__total');
    expect(t).toContain('Doors &amp; &lt;frames&gt;');
  });

  it('leaves the IOSH hero (hazard scan) as it was', () => {
    const t = courseTop(iosh);
    expect(t).not.toMatch(/cbg-scrub|cbg-takeoff/);
    expect(t).toContain('data-cbg-hazard');
  });
});
