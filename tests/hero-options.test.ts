import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { DIAGRAM_VISUALS, loadCourse, loadHeroOptions, validateCourse, type Course } from '../content/schema';
import { courseTop } from '../templates/course';
import { band, slots } from '../templates/sections/course-hero-options';

// The hero options (content/hero-options/iosh-level-3.yaml, templates/sections/course-hero-options.ts).
const iosh = loadCourse('iosh-level-3.yaml');
const raw = parse(readFileSync('content/hero-options/iosh-level-3.yaml', 'utf8'));
const shared = () => {
  const h: Record<string, unknown> = { ...JSON.parse(JSON.stringify(iosh.hero)) };
  for (const k of ['image', 'imageAlt', 'hazards', 'tour']) delete h[k];
  return h;
};
// The IOSH course with its hero switched to an option. make-it-safe borrows the worksite photo for its
// made-safe one, so these tests don't depend on that photo being built yet.
const withHero = (visual: string, fields: Record<string, unknown>) =>
  validateCourse({ ...JSON.parse(JSON.stringify(iosh)), hero: { ...shared(), ...JSON.parse(JSON.stringify(fields)), visual } });
const safeFields = () => {
  const f = JSON.parse(JSON.stringify(raw['make-it-safe']));
  f.safe.image = 'hazard-worksite';
  return f;
};

describe('hero options file', () => {
  it('has all four options, each either built or waiting for its photo, and leaves the live hero alone', () => {
    const { options, waiting } = loadHeroOptions(iosh);
    expect([...options.map((o) => o.visual), ...waiting].sort()).toEqual(['hierarchy', 'make-it-safe', 'risk-matrix', 'swiss-cheese']);
    for (const d of DIAGRAM_VISUALS) expect(options.map((o) => o.visual)).toContain(d);
    expect(iosh.hero.visual).toBe('hazard-scan');
    for (const { course } of options) {
      expect(course.hero.hazards).toBeUndefined();
      expect(course.hero.heading).toBe(iosh.hero.heading);
    }
  });

  it('is plain English with no em-dashes (the same content check as the live page)', () => {
    expect(JSON.stringify(raw)).not.toContain(String.fromCharCode(0x2014));
  });
});

describe('hero option checks', () => {
  it('diagram options take no photo; make-it-safe needs one and its safe data', () => {
    expect(() => withHero('risk-matrix', { ...raw['risk-matrix'], image: 'hazard-worksite' })).toThrow('hero.image: not used with visual: risk-matrix; remove it');
    expect(() => withHero('make-it-safe', { image: 'hazard-worksite', imageAlt: 'x' })).toThrow('hero.safe: missing field (visual: make-it-safe needs it)');
    expect(() => withHero('hierarchy', raw['swiss-cheese'])).toThrow('hero.hierarchy: missing field');
  });

  it('make-it-safe: the made-safe photo is built, the same size, and every fix is inside it', () => {
    expect(() => withHero('make-it-safe', safeFields())).not.toThrow();
    const f = safeFields();
    f.safe.image = 'no-such-photo';
    expect(() => withHero('make-it-safe', f)).toThrow('hero.safe.image: no image "no-such-photo"');
    f.safe.image = 'course-iosh';
    expect(() => withHero('make-it-safe', f)).toThrow(/hero\.safe\.image: "course-iosh" is \d+x\d+; it must be the same size as "hazard-worksite" \(1536x1024\)/);
    const g = safeFields();
    g.safe.fixes[1].at = [1600, 10];
    expect(() => withHero('make-it-safe', g)).toThrow('hero.safe.fixes[1].at: must be [x, y] inside 1536x1024');
  });

  it('risk-matrix: four band names and ratings of 1 to 5', () => {
    const f = JSON.parse(JSON.stringify(raw['risk-matrix']));
    f.matrix.risks[2].to = [0, 3];
    expect(() => withHero('risk-matrix', f)).toThrow('hero.matrix.risks[2].to: must be [likelihood, severity], each 1 to 5');
    f.matrix.risks[2].to = [1, 3];
    f.matrix.risks[0].from = [2.5, 3];
    expect(() => withHero('risk-matrix', f)).toThrow('hero.matrix.risks[0].from');
    f.matrix.risks[0].from = [2, 3];
    f.matrix.levels = ['Low', 'High'];
    expect(() => withHero('risk-matrix', f)).toThrow('hero.matrix.levels: name the 4 bands');
  });

  it('hierarchy: 3 to 6 tiers; swiss-cheese: 2 to 5 layers, exactly one fixed', () => {
    const t = JSON.parse(JSON.stringify(raw.hierarchy));
    t.hierarchy.tiers = t.hierarchy.tiers.slice(0, 2);
    expect(() => withHero('hierarchy', t)).toThrow('hero.hierarchy.tiers: list 3 to 6 tiers; got 2');
    const c = JSON.parse(JSON.stringify(raw['swiss-cheese']));
    c.cheese.layers[0].fix = 'Plan made';
    expect(() => withHero('swiss-cheese', c)).toThrow('give exactly one layer a `fix`');
    delete c.cheese.layers[0].fix;
    delete c.cheese.layers[1].fix;
    expect(() => withHero('swiss-cheese', c)).toThrow('give exactly one layer a `fix`');
  });
});

describe('risk matrix geometry', () => {
  it('bands scores 1-4, 5-9, 10-16, 20-25', () => {
    expect([1, 4, 5, 9, 10, 16, 20, 25].map(band)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('puts a marker at its cell centre, likelihood 5 on top, and spreads markers that share a cell', () => {
    expect(slots([[5, 1]])).toEqual([{ x: 10, y: 10 }]);
    expect(slots([[1, 5]])).toEqual([{ x: 90, y: 90 }]);
    const [a, b, c] = slots([[1, 3], [2, 2], [1, 3]]);
    expect(a.y).toBe(c.y);
    expect(a.x).toBeLessThan(50);
    expect(c.x).toBeGreaterThan(50);
    expect((a.x + c.x) / 2).toBeCloseTo(50);
    expect(b).toEqual({ x: 30, y: 70 });
  });
});

describe('hero option markup', () => {
  const top = (visual: string, fields: Record<string, unknown>) => courseTop(withHero(visual, fields) as Course);

  it('make-it-safe: the made-safe photo is the LCP image, the photo as found lies over it, the slider waits for the script', () => {
    const html = top('make-it-safe', safeFields());
    expect(html).toContain('data-cbg-safe');
    expect((html.match(/fetchpriority="high"/g) ?? []).length).toBe(1);
    expect(html).toMatch(/<div class="cbg-safe__before" aria-hidden="true"><picture>/);
    expect(html).toMatch(/<input class="cbg-safe__range" type="range"[^>]* aria-label="Compare the site as found and made safe" hidden>/);
    expect((html.match(/class="cbg-safe-pin( cbg-safe-pin--l)?"/g) ?? []).length).toBe(6);
    expect(html).toContain('<li><b aria-hidden="true">1</b> <span><s>Open edge, no guardrail</s> <strong>Guardrail and toe board fitted</strong></span></li>');
    expect(html).toContain('style="--x:22.53%;--y:13.67%" data-cbg-x="22.53"');
  });

  it('risk-matrix: 25 cells, a ring and a marker per risk, and the ratings in words', () => {
    const html = top('risk-matrix', raw['risk-matrix']);
    expect((html.match(/class="cbg-cell cbg-cell--/g) ?? []).length).toBe(25);
    expect((html.match(/class="cbg-risk cbg-risk--was"/g) ?? []).length).toBe(6 + 1); // + the key
    expect(html).toContain('<strong>Open edge, no guardrail</strong> Before controls: Very high (20). After controls: Medium (5). Guardrail and toe board fitted.');
    expect(html).not.toContain('fetchpriority');
  });

  it('hierarchy: the tiers in order, most effective first, each with its example', () => {
    const html = top('hierarchy', raw.hierarchy);
    const names = [...html.matchAll(/<span class="cbg-tier__bar"><strong>([^<]+)<\/strong>/g)].map((m) => m[1]);
    expect(names).toEqual(['Elimination', 'Substitution', 'Engineering controls', 'Administrative controls', 'Personal protective equipment']);
    expect(html).toContain('<p class="cbg-tiers__scale"><span>Most effective</span>');
  });

  it('swiss-cheese: one slice per layer, the fixed one marked, the ray stopping at its centre', () => {
    const html = top('swiss-cheese', raw['swiss-cheese']);
    expect((html.match(/class="cbg-slice( is-fix)?"/g) ?? []).length).toBe(4);
    expect(html).toContain('<span class="cbg-slice is-fix" style="--i:1">');
    expect(html).toContain('style="--n:4;--stop:37.5%"');
    expect(html).toContain('<li class="is-fix"><strong>Edge protection</strong> <s>No guardrail fitted</s> <span>Guardrail fitted before work starts</span></li>');
  });
});
