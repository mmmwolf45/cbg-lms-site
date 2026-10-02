import { describe, expect, it } from 'vitest';
import { homeSections, loadCourses, loadHome, type Course, type Home } from '../content/schema';
import { home } from '../templates/home';

const h = loadHome();
const courses = loadCourses();
const html = home(h, courses);
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

// Every string in a content object, replaced by fn(path) so we can trace where it lands.
function mapStrings<T>(v: T, fn: (s: string) => string): T {
  if (typeof v === 'string') return fn(v) as T;
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, fn)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x, fn)])) as T;
  return v;
}

describe('home block (T11, T12)', () => {
  it('is one block root', () => {
    expect(html.startsWith('<div data-cbg="home" class="cbg-block">')).toBe(true);
    expect(html.endsWith('</div>')).toBe(true);
  });

  it.each(homeSections)('renders section %s exactly once', (id) => {
    expect(count(html, new RegExp(`id="cbg-${id}"`, 'g'))).toBe(1);
    expect(count(html, new RegExp(`data-cbg-section="${id}"`, 'g'))).toBe(1);
  });

  it('renders the sections in content order', () => {
    const at = homeSections.map((id) => html.indexOf(`id="cbg-${id}"`));
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('has exactly one h1', () => expect(count(html, /<h1[\s>]/g)).toBe(1));

  it('has no em-dash or en-dash', () => {
    expect(html).not.toContain(String.fromCharCode(0x2014));
    expect(html).not.toContain(String.fromCharCode(0x2013));
  });

  it('has no scripts and no inline event handlers', () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it('carries the motion hooks from the markup contract', () => {
    for (const hook of ['data-cbg-hero', 'data-cbg-thread', 'data-cbg-ticks', 'data-cbg-action="login"', 'class="cbg-hero__lines"'])
      expect(html).toContain(hook);
    expect(count(html, /class="cbg-tick"/g)).toBe(h['first-steps'].items.length);
  });

  it('splits the hero heading without changing its words', () => {
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)![1];
    expect(h1.replace(/<[^>]+>/g, '')).toBe(h.hero.heading);
    expect(h1).toContain('<span class="cbg-gold">CBG</span>');
  });

  it('bolds the about highlight', () => expect(html).toContain(`<strong>${h.about.highlight}</strong>`));

  it('escapes every content string', () => {
    const evil = '<script>alert(1)</script>"&\'';
    const bad = mapStrings(h, (s) => (s.startsWith('http') || s.startsWith('mailto') || s.endsWith('.png') ? s : `${s}${evil}`));
    const out = home(bad as Home, courses.map((c) => mapStrings(c, (s) => `${s}${evil}`)) as Course[]);
    expect(out).not.toContain('<script>');
    expect(out).not.toContain(evil);
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;&quot;&amp;&#39;');
  });

  it('adds a card for each course with no template change', () => {
    const first = courses[0];
    const second: Course = {
      ...first, slug: 'second-course',
      card: { ...first.card, title: 'Second Course Title', cta: { label: 'Open course', href: '/course/202-second' } },
    };
    const out = home(h, [...courses, second]);
    expect(count(out, /class="cbg-card cbg-course"/g)).toBe(courses.length + 1);
    expect(out).toContain('Second Course Title');
    expect(out).toContain('href="/course/202-second"');
  });

  it('uses absolute image URLs on the Pages base, with sizes and dimensions', () => {
    const imgs = html.match(/<img [^>]*>/g)!;
    for (const img of imgs) {
      expect(img).toMatch(/src="https:\/\/mmmwolf45\.github\.io\/cbg-lms-site\//);
      expect(img).toMatch(/ width="\d+" height="\d+"/);
      expect(img).toMatch(/ alt="/);
    }
    expect(count(html, /fetchpriority="high"/g)).toBe(1);
  });
});
