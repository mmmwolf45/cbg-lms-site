import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { courseSections, HERO_VISUALS, loadCourse, loadCourses, validateCourse, type Course } from '../content/schema';
import { courseMain, courseTop } from '../templates/course';
import images from '../src/images.json';

// Every real course, plus the dummy (content/courses/_dummy.yaml) with a different set of sections.
const courses = [...loadCourses(), loadCourse('_dummy.yaml')];
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const ENT: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const text = (html: string) =>
  html.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|#39);/g, (e) => ENT[e]).replace(/\s+/g, ' ').trim();

// Every string in a content object, replaced by fn(s) so we can trace where it lands.
function mapStrings<T>(v: T, fn: (s: string) => string): T {
  if (typeof v === 'string') return fn(v) as T;
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, fn)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x, fn)])) as T;
  return v;
}

describe.each(courses.map((c) => [c.slug, c] as const))('course blocks: %s (T18, T19, T27)', (slug, c) => {
  const top = courseTop(c);
  const main = courseMain(c);
  const both = top + main;
  const present = courseSections.filter((id) => c[id]);

  it('renders two block roots', () => {
    expect(top.startsWith(`<div data-cbg="${slug}-top" class="cbg-block cbg-course-page`)).toBe(true);
    expect(main.startsWith(`<div data-cbg="${slug}-main" class="cbg-block cbg-course-page`)).toBe(true);
    for (const b of [top, main]) expect(b.endsWith('</div>')).toBe(true);
  });

  it('puts only the hero in the top block', () => {
    expect(count(top, /data-cbg-section="/g)).toBe(1);
    expect(top).toContain('data-cbg-section="hero"');
    expect(main).not.toContain('data-cbg-section="hero"');
  });

  it.each(courseSections)('renders section %s once if the YAML has it, else not at all', (id) => {
    const n = c[id] ? 1 : 0;
    expect(count(both, new RegExp(`id="cbg-${id}"`, 'g'))).toBe(n);
    expect(count(both, new RegExp(`data-cbg-section="${id}"`, 'g'))).toBe(n);
  });

  it('renders the main sections in content order', () => {
    const at = present.filter((id) => id !== 'hero').map((id) => main.indexOf(`id="cbg-${id}"`));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('has no h1 (the native course title is the h2 above us)', () => expect(count(both, /<h1[\s>]/g)).toBe(0));

  it('has no em-dash or en-dash', () => {
    expect(both).not.toContain(String.fromCharCode(0x2014));
    expect(both).not.toContain(String.fromCharCode(0x2013));
  });

  it('has no scripts and no inline event handlers', () => {
    expect(both).not.toMatch(/<script/i);
    expect(both).not.toMatch(/\son[a-z]+=/i);
  });

  it('keeps headings word for word when split into two tones', () => {
    const h2s = [...both.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => text(m[1]));
    for (const id of present) expect(h2s).toContain((c[id] as { heading: string }).heading);
  });

  it('hero: Start here, and the hooks and eager image its visual needs', () => {
    expect(top).toContain(`href="#course_content" data-cbg-action="start-here"`);
    const scan = c.hero.visual === 'hazard-scan';
    expect(count(top, /data-cbg-hazard[\s>]/g)).toBe(scan ? 1 : 0);
    expect(count(top, /data-cbg-hazard-list/g)).toBe(scan ? 1 : 0);
    expect(count(top, /<div class="cbg-hazard-caption" aria-live="off"><\/div>/g)).toBe(scan ? 1 : 0);
    expect(count(top, /fetchpriority="high"/g)).toBe(c.hero.visual === 'none' ? 0 : 1);
    if (c.hero.image) expect(top).toContain(`/img/${c.hero.image}-`);
    expect(count(main, /fetchpriority="high"/g)).toBe(0);
  });

  it('hero: each visual renders its own markup', () => {
    const hz = { label: 'Open trench', detail: 'No barrier.', at: [10, 10], zoom: [0, 0, 100, 100] };
    const base = { ...c.hero, image: 'hazard-worksite', imageAlt: 'A worksite', hazards: undefined, tour: undefined };
    const scan = courseTop({ ...c, hero: { ...base, visual: 'hazard-scan', hazards: [hz, { ...hz, label: 'Trailing cable', detail: 'A trip hazard.' }], tour: { previous: 'Back', next: 'On' } } });
    const list = scan.match(/<ol class="cbg-hazards" data-cbg-hazard-list>([\s\S]*?)<\/ol>/)![1];
    expect(count(list, /<li id="cbg-hazard-\d">/g)).toBe(2);
    expect(text(list)).toBe('Open trench No barrier.Trailing cable A trip hazard.');
    const photo = courseTop({ ...c, hero: { ...base, visual: 'photo' } });
    expect(photo).toContain('<div class="cbg-hazard"><div class="cbg-frame"><picture>');
    expect(photo).toContain('alt="A worksite" fetchpriority="high"');
    expect(photo).not.toMatch(/data-cbg-hazard|cbg-hazard-dot|cbg-hazard-caption/);
    const none = courseTop({ ...c, hero: { ...base, visual: 'none', image: undefined, imageAlt: undefined } });
    expect(none).not.toMatch(/<picture|cbg-hazard/);
    expect(none).toContain('<ul class="cbg-facts">');
  });

  it('counters follow the contract: aria-hidden number next to an sr-only copy', () => {
    const counters = [...both.matchAll(/<span([^>]*data-cbg-count="(\d+)"[^>]*)>([^<]*)<\/span><span class="cbg-sr-only">([^<]*)<\/span>/g)];
    expect(counters.length).toBe(count(both, /data-cbg-count=/g));
    for (const [, attrs, n, shown, sr] of counters) {
      expect(attrs).toContain('aria-hidden="true"');
      expect(shown).toBe(n);
      expect(sr).toBe(n);
    }
    // Hero facts: one counter per fact with `count`; "About" stays outside the counted number.
    const counted = c.hero.facts.filter((f) => f.count !== undefined);
    expect(count(top, /data-cbg-count=/g)).toBe(counted.length);
    for (const f of counted.filter((f) => f.prefix)) expect(top).toContain(`<small>${f.prefix}</small> <span aria-hidden="true" data-cbg-count="${f.count}">`);
    // The hours total (if there are units) and one counter per assessment task.
    const total = c.units?.units.reduce((n, u) => n + u.glh, 0);
    if (total !== undefined) expect(main).toContain(`data-cbg-count="${total}"`);
    const tasks = c.assessment?.assessments.flatMap((a) => a.tasks ?? []) ?? [];
    expect(count(main, /data-cbg-count=/g)).toBe((c.units ? 1 : 0) + tasks.length);
  });

  it.runIf(c.units)('units: one floor and one unit per unit, numbered alike, under data-cbg-build', () => {
    const units = c.units!.units;
    const floors = [...main.matchAll(/data-cbg-floor="(\d+)"/g)].map((m) => +m[1]);
    const cards = [...main.matchAll(/data-cbg-unit="(\d+)"/g)].map((m) => +m[1]);
    const seq = units.map((_, i) => i + 1);
    expect(floors).toEqual(seq);
    expect(cards).toEqual(seq);
    expect(main).toMatch(/<section id="cbg-units"[^>]*data-cbg-build/);
    for (const u of units) expect(main).toContain(u.code);
    // build80.ts reads each floor's hours as the number at the start of its label.
    const labels = [...main.matchAll(/<text class="cbg-floor__glh"[^>]*>([^<]*)<\/text>/g)].map((m) => parseInt(m[1]));
    expect(labels).toEqual(units.map((u) => u.glh));
  });

  it.runIf(c.included)('included: every card, the featured one marked', () => {
    expect(main).toContain('data-cbg-hand');
    expect(count(main, /class="cbg-card cbg-kit/g)).toBe(c.included!.cards.length);
    expect(count(main, /cbg-kit cbg-card--feat/g)).toBe(c.included!.cards.filter((x) => x.featured).length);
  });

  it.runIf(c.assessment)('assessment: quadrant grid and every card', () => {
    expect(main).toContain('data-cbg-quadrants');
    expect(count(main, /class="cbg-card cbg-exam"/g)).toBe(c.assessment!.assessments.length);
  });

  it.runIf(c.trainers)('trainers: a lazy photo per trainer', () => {
    const photos = main.match(/<div class="cbg-trainer__photo">[\s\S]*?<\/div>/g)!;
    expect(photos.length).toBe(c.trainers!.trainers.length);
    for (const p of photos) expect(p).toContain('loading="lazy"');
  });

  it.runIf(c.bonus)('bonus: a gold-thread path of steps', () => {
    const path = main.match(/<ol class="cbg-steps cbg-path" data-cbg-thread[^>]*>([\s\S]*?)<\/ol>/)![1];
    expect(count(path, /class="cbg-node"/g)).toBe(c.bonus!.steps.length);
  });

  it.runIf(c['field-guides'])('field guides: every cover in a keyboard-scrollable shelf', () => {
    const g = c['field-guides']!;
    expect(count(main, /class="cbg-cover[ "]/g)).toBe(g.released.length + g.upcoming.length + g.unnamedUpcoming);
    if (slug === 'iosh-level-3') expect(count(main, /class="cbg-cover[ "]/g)).toBe(8);
    expect(main).toContain(`data-cbg-shelf tabindex="0" role="region" aria-label="${g.heading}"`);
    expect(count(main, new RegExp(`>${g.comingSoonLabel}<`, 'g'))).toBe(g.upcoming.length + g.unnamedUpcoming);
  });

  it.runIf(c.faq)('faq: every item as a closed native <details>', () => {
    expect(main).toContain('<div class="cbg-faq" data-cbg-faq>');
    expect(count(main, /<details>/g)).toBe(c.faq!.items.length);
    expect(count(main, /<details open/g)).toBe(0);
    if (slug === 'iosh-level-3') expect(c.faq!.items.length).toBe(12);
  });

  it.runIf(c.help)('help: WhatsApp, email, every logo and the band image', () => {
    const h = c.help!;
    expect(main).toContain(`href="${h.whatsapp.href}"`);
    expect(main).toContain(`href="${h.email.href}"`);
    expect(count(main.slice(main.indexOf('cbg-closing__logos')), /<img /g)).toBe(h.logos.length);
    expect(main).toContain(`<picture class="cbg-closing__bg"><source type="image/avif" srcset="https://mmmwolf45.github.io/cbg-lms-site/img/${h.image ?? 'closing-plate'}-`);
  });

  it('uses absolute image URLs on the Pages base, with sizes and dimensions', () => {
    for (const img of both.match(/<img [^>]*>/g) ?? []) {
      expect(img).toMatch(/src="https:\/\/mmmwolf45\.github\.io\/cbg-lms-site\//);
      expect(img).toMatch(/ width="\d+" height="\d+"/);
      expect(img).toMatch(/ alt="/);
    }
  });

  it('escapes every content string', () => {
    const evil = '<script>alert(1)</script>"&\'';
    // Links, file names, image names and the hero visual are not copy: they stay as they are.
    const keep = (s: string) => s.startsWith('http') || s.startsWith('mailto') || s.startsWith('#') || /\.(png|jpg)$/.test(s)
      || s in images || (HERO_VISUALS as readonly string[]).includes(s);
    const bad = mapStrings(c, (s) => (keep(s) ? s : `${s}${evil}`));
    const out = courseTop(bad) + courseMain(bad);
    expect(out).not.toContain('<script>');
    expect(out).not.toContain(evil);
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;&quot;&amp;&#39;');
  });
});

// Variable counts in the sections a course may size differently (T27).
describe('course sections with other counts', () => {
  const iosh = loadCourses().find((c) => c.slug === 'iosh-level-3')!;
  const withUnits = (glh: number[]): Course => ({
    ...iosh, units: { ...iosh.units!, units: glh.map((h, i) => ({ ...iosh.units!.units[0], code: `U${i + 1}`, glh: h })) },
  });
  const floors = (html: string) => [...html.matchAll(/<rect x="28" y="([\d.]+)" width="144" height="([\d.]+)"\/>/g)].map((m) => [+m[1], +m[2]]);

  it.each([[[10]], [[5, 5, 5]], [[1, 40, 3, 2, 30, 4]]])('units %j: floors stack from the ground to the roof, each tall enough for its labels', (glh) => {
    const f = floors(courseMain(withUnits(glh)));
    expect(f).toHaveLength(glh.length);
    expect(f[0][0] + f[0][1]).toBeCloseTo(276, 0); // Unit 1 on the ground
    expect(f.at(-1)![0]).toBeCloseTo(36, 0); // the last unit under the roof
    for (const [, h] of f) expect(h).toBeGreaterThanOrEqual(19.9);
  });

  it.each([1, 2, 3, 5])('assessment with %i tasks: one tile and one pie slice each', (n) => {
    const tasks = Array.from({ length: n }, (_, i) => ({ name: `task ${i + 1}`, marks: 10 }));
    const a = iosh.assessment!;
    const out = courseMain({ ...iosh, assessment: { ...a, assessments: [{ ...a.assessments[1], tasks }] } });
    const quads = out.match(/<ul class="cbg-quads" data-cbg-quadrants>([\s\S]*?)<\/ul>/)![1];
    expect(count(quads, /<li>/g)).toBe(n);
    const slices = [...quads.matchAll(/<path d="([^"]+)"\/>/g)].map((m) => m[1]);
    expect(new Set(slices).size).toBe(n);
    for (const d of slices) expect(d).not.toMatch(/NaN/);
  });

  it('field guides: leaves out an empty group', () => {
    const g = iosh['field-guides']!;
    const out = courseMain({ ...iosh, 'field-guides': { ...g, upcoming: [], unnamedUpcoming: 0 } });
    expect(count(out, /class="cbg-shelf__group"/g)).toBe(1);
    expect(out).not.toContain(g.upcomingLabel);
  });
});

describe('dummy course: content/courses/_dummy.yaml (T27)', () => {
  const d = loadCourse('_dummy.yaml');
  const html = courseTop(d) + courseMain(d);

  it('is left out of normal builds', () => expect(loadCourses().map((c) => c.slug)).not.toContain('_dummy'));

  it('renders exactly its own sections, in page order', () => {
    expect([...html.matchAll(/data-cbg-section="([^"]+)"/g)].map((m) => m[1])).toEqual(['hero', 'included', 'units', 'faq', 'help']);
  });

  it('uses a plain photo hero and three units', () => {
    expect(d.hero.visual).toBe('photo');
    expect(html).toContain('/img/closing-plate-');
    expect(html).not.toContain('data-cbg-hazard');
    expect(count(html, /data-cbg-floor="/g)).toBe(3);
    expect(html).toContain('>2 h</text>');
  });
});

describe('course schema: optional sections and hero visuals (T27)', () => {
  const yaml = () => parse(readFileSync('content/courses/iosh-level-3.yaml', 'utf8'));

  it('needs only slug, uniqueId, path, card and hero', () => {
    const c = yaml();
    for (const id of courseSections) if (id !== 'hero') delete c[id];
    expect(() => validateCourse(c)).not.toThrow();
    expect(courseMain(validateCourse(c))).toBe('<div data-cbg="iosh-level-3-main" class="cbg-block cbg-course-page cbg-course-page--main"></div>');
    delete c.card;
    expect(() => validateCourse(c)).toThrow('card: missing section');
  });

  it('accepts only the three hero visuals', () => {
    const c = yaml();
    c.hero.visual = 'video';
    expect(() => validateCourse(c)).toThrow('hero.visual: must be hazard-scan, photo, none; got "video"');
    delete c.hero.visual;
    expect(() => validateCourse(c)).toThrow('hero.visual: missing field');
  });

  it("requires each visual's fields and refuses the others", () => {
    let c = yaml();
    delete c.hero.tour;
    expect(() => validateCourse(c)).toThrow('hero.tour: missing field (visual: hazard-scan needs it)');
    c = yaml();
    c.hero.visual = 'photo';
    expect(() => validateCourse(c)).toThrow('hero.hazards: not used with visual: photo; remove it');
    delete c.hero.hazards;
    delete c.hero.tour;
    expect(() => validateCourse(c)).not.toThrow();
    delete c.hero.imageAlt;
    expect(() => validateCourse(c)).toThrow('hero.imageAlt: missing field (visual: photo needs it)');
    c.hero.visual = 'none';
    expect(() => validateCourse(c)).toThrow('hero.image: not used with visual: none; remove it');
    delete c.hero.image;
    expect(() => validateCourse(c)).not.toThrow();
  });

  it('checks image names against src/images.json, and the Hazard Scan photo is 3:2', () => {
    const c = yaml();
    c.hero.image = 'nope';
    expect(() => validateCourse(c)).toThrow('hero.image: no image "nope" in src/images.json');
    c.hero.image = 'trainer-ali-orkkatteri';
    expect(() => validateCourse(c)).toThrow('hero.image: the Hazard Scan photo must be 3:2');
    c.hero.image = 'hazard-worksite';
    c.help.image = 'nope';
    expect(() => validateCourse(c)).toThrow('help.image: no image "nope"');
    c.hero.hazards = [];
    expect(() => validateCourse(c)).toThrow('hero.hazards: list at least one hazard');
  });

  it('refuses a field-guide shelf wider than the laptop column', () => {
    const c = yaml();
    const g = c['field-guides'];
    g.released.push({ label: 'Field Guide 02', title: g.upcoming.shift() });
    expect(() => validateCourse(c)).toThrow('field-guides: 2 released + 6 upcoming covers are 824px wide on a laptop');
    g.unnamedUpcoming = 1;
    expect(() => validateCourse(c)).not.toThrow();
  });
});
