import { describe, expect, it } from 'vitest';
import { courseSections, loadCourses, type Course } from '../content/schema';
import { courseMain, courseTop } from '../templates/course';

const courses = loadCourses();
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

describe.each(courses.map((c) => [c.slug, c] as const))('course blocks: %s (T18, T19)', (slug, c) => {
  const top = courseTop(c);
  const main = courseMain(c);
  const both = top + main;

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

  it.each(courseSections)('renders section %s exactly once across both blocks', (id) => {
    expect(count(both, new RegExp(`id="cbg-${id}"`, 'g'))).toBe(1);
    expect(count(both, new RegExp(`data-cbg-section="${id}"`, 'g'))).toBe(1);
  });

  it('renders the main sections in content order', () => {
    const at = courseSections.filter((id) => id !== 'hero').map((id) => main.indexOf(`id="cbg-${id}"`));
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
    for (const id of courseSections) expect(h2s).toContain((c[id] as { heading: string }).heading);
  });

  it('hero: Start here, hazard hooks and the eager hazard photo', () => {
    expect(top).toContain(`href="#course_content" data-cbg-action="start-here"`);
    expect(top).toContain('data-cbg-hazard');
    expect(top).toContain('<div class="cbg-hazard-caption" aria-live="polite"></div>');
    expect(count(top, /data-cbg-hazard-list/g)).toBe(c.hero.hazards.length ? 1 : 0);
    expect(count(top, /fetchpriority="high"/g)).toBe(1);
    expect(count(main, /fetchpriority="high"/g)).toBe(0);
  });

  it('lists hazards as a plain list when there are any', () => {
    const withHazards: Course = { ...c, hero: { ...c.hero, hazards: [{ label: 'Open trench' }, { label: 'Trailing cable' }] } };
    const out = courseTop(withHazards);
    const list = out.match(/<ol class="cbg-hazards" data-cbg-hazard-list>([\s\S]*?)<\/ol>/)![1];
    expect(count(list, /<li>/g)).toBe(2);
    expect(text(list)).toBe('Open trenchTrailing cable');
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
    // The GLH total and one counter per assessment task.
    const total = c.units.units.reduce((n, u) => n + u.glh, 0);
    expect(main).toContain(`data-cbg-count="${total}"`);
    const tasks = c.assessment.assessments.flatMap((a) => a.tasks ?? []);
    expect(count(main, /data-cbg-count=/g)).toBe(1 + tasks.length);
  });

  it('units: one floor and one unit per unit, numbered alike, under data-cbg-build', () => {
    const n = c.units.units.length;
    const floors = [...main.matchAll(/data-cbg-floor="(\d+)"/g)].map((m) => +m[1]);
    const units = [...main.matchAll(/data-cbg-unit="(\d+)"/g)].map((m) => +m[1]);
    const seq = Array.from({ length: n }, (_, i) => i + 1);
    expect(floors).toEqual(seq);
    expect(units).toEqual(seq);
    expect(main).toMatch(/<section id="cbg-units"[^>]*data-cbg-build/);
    for (const u of c.units.units) expect(main).toContain(u.code);
  });

  it('included: every card, the featured one marked', () => {
    expect(main).toContain('data-cbg-hand');
    expect(count(main, /class="cbg-card cbg-kit/g)).toBe(c.included.cards.length);
    expect(count(main, /cbg-kit cbg-card--feat/g)).toBe(c.included.cards.filter((x) => x.featured).length);
  });

  it('assessment: quadrant grid and both cards', () => {
    expect(main).toContain('data-cbg-quadrants');
    expect(count(main, /class="cbg-card cbg-exam"/g)).toBe(c.assessment.assessments.length);
  });

  it('trainers: a lazy photo per trainer', () => {
    const photos = main.match(/<div class="cbg-trainer__photo">[\s\S]*?<\/div>/g)!;
    expect(photos.length).toBe(c.trainers.trainers.length);
    for (const p of photos) expect(p).toContain('loading="lazy"');
  });

  it('bonus: a gold-thread path of steps', () => {
    const path = main.match(/<ol class="cbg-steps cbg-path" data-cbg-thread[^>]*>([\s\S]*?)<\/ol>/)![1];
    expect(count(path, /class="cbg-node"/g)).toBe(c.bonus.steps.length);
  });

  it('field guides: 8 covers in a keyboard-scrollable shelf', () => {
    const g = c['field-guides'];
    expect(count(main, /class="cbg-cover[ "]/g)).toBe(g.released.length + g.upcoming.length + g.unnamedUpcoming);
    expect(count(main, /class="cbg-cover[ "]/g)).toBe(8);
    expect(main).toContain(`data-cbg-shelf tabindex="0" role="region" aria-label="${g.heading}"`);
    expect(count(main, new RegExp(`>${g.comingSoonLabel}<`, 'g'))).toBe(g.upcoming.length + g.unnamedUpcoming);
  });

  it('faq: every item as a closed native <details>', () => {
    expect(main).toContain('<div class="cbg-faq" data-cbg-faq>');
    expect(count(main, /<details>/g)).toBe(c.faq.items.length);
    expect(count(main, /<details open/g)).toBe(0);
    if (slug === 'iosh-level-3') expect(c.faq.items.length).toBe(12);
  });

  it('help: WhatsApp, email and both marks', () => {
    expect(main).toContain(`href="${c.help.whatsapp.href}"`);
    expect(main).toContain(`href="${c.help.email.href}"`);
    expect(count(main.slice(main.indexOf('cbg-closing__logos')), /<img /g)).toBe(c.help.logos.length);
  });

  it('uses absolute image URLs on the Pages base, with sizes and dimensions', () => {
    for (const img of both.match(/<img [^>]*>/g)!) {
      expect(img).toMatch(/src="https:\/\/mmmwolf45\.github\.io\/cbg-lms-site\//);
      expect(img).toMatch(/ width="\d+" height="\d+"/);
      expect(img).toMatch(/ alt="/);
    }
  });

  it('escapes every content string', () => {
    const evil = '<script>alert(1)</script>"&\'';
    const keep = (s: string) => s.startsWith('http') || s.startsWith('mailto') || s.startsWith('#') || /\.(png|jpg)$/.test(s);
    const bad = mapStrings(c, (s) => (keep(s) ? s : `${s}${evil}`));
    const out = courseTop(bad) + courseMain(bad);
    expect(out).not.toContain('<script>');
    expect(out).not.toContain(evil);
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;&quot;&amp;&#39;');
  });
});
