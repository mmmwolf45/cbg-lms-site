import { describe, expect, it } from 'vitest';
import { homeSections, loadCourseFiles, loadHome, type CardOnly, type CourseFile, type Home } from '../content/schema';
import images from '../src/images.json';
import { home } from '../templates/home';
import { OUTLINED, disciplines, letters } from '../templates/sections/home-disciplines';

const h = loadHome();
const courses = loadCourseFiles();
const html = home(h, courses);
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
// One section's HTML, from its opening tag to the next section's.
const sectionHtml = (out: string, id: string) => {
  const at = out.indexOf(`<section id="cbg-${id}"`);
  const next = out.indexOf('<section ', at + 1);
  return out.slice(at, next < 0 ? undefined : next);
};
const soon = (title: string, order: number, extra: Partial<CardOnly['card']> = {}): CardOnly =>
  ({ slug: title.toLowerCase(), card: { title, status: 'coming soon', order, ...extra } });
// The band shows only once `npm run images` has built its photo.
const bandBuilt = !!h.band && h.band.image in images;
const rendered = homeSections.filter((id) => id !== 'band' || bandBuilt);

// Every string in a content object, replaced by fn(path) so we can trace where it lands.
function mapStrings<T>(v: T, fn: (s: string) => string): T {
  if (typeof v === 'string') return fn(v) as T;
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, fn)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x, fn)])) as T;
  return v;
}

describe('home block', () => {
  it('is one block root', () => {
    expect(html.startsWith('<div data-cbg="home" class="cbg-block">')).toBe(true);
    expect(html.endsWith('</div>')).toBe(true);
  });

  it.each(rendered)('renders section %s exactly once', (id) => {
    expect(count(html, new RegExp(`id="cbg-${id}"`, 'g'))).toBe(1);
    expect(count(html, new RegExp(`data-cbg-section="${id}"`, 'g'))).toBe(1);
  });

  it('renders the sections in content order', () => {
    const at = rendered.map((id) => html.indexOf(`id="cbg-${id}"`));
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
    for (const hook of ['data-cbg-hero', 'data-cbg-thread', 'data-cbg-gallery', 'data-cbg-action="login"', 'data-cbg-explode'])
      expect(html).toContain(hook);
    expect(html).not.toContain('data-cbg-ticks');
  });

  it('keeps the hero heading readable once (sr-only) and splits a hidden copy into the same words', () => {
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)![1];
    expect(h1).toContain(`<span class="cbg-sr-only">${h.hero.heading}</span>`);
    const split = h1.match(/<span class="cbg-explode__words" aria-hidden="true">([\s\S]*)<\/span>$/)![1];
    const words = (x: string) => x.replace(/<[^>]+>/g, ' ').replace(/ (?=\S) /g, ' ').split(/\s+/).filter(Boolean);
    expect(words(split.replace(/<\/span><span class="cbg-l">/g, ''))).toEqual(h.hero.heading.split(' '));
    expect(split.match(/cbg-explode__line/g)).toHaveLength(3); // Welcome / to your CBG / classroom
    // "Welcome / to your / classroom": the last word carries the gold (the CBG mark sits behind the building).
    expect(split).toMatch(/cbg-w--gold"><span class="cbg-l">c<\/span>/);
    expect(split).not.toContain('cbg-w--dim');
  });

  it('puts the subtitle and the faint CBG mark in the hero', () => {
    const hero = sectionHtml(html, 'hero');
    expect(hero).toContain(`<p class="cbg-explode__sub">${h.hero.subhead}</p>`);
    expect(hero).toMatch(/<img class="cbg-explode__mark" src="https:\/\/[^"]+\/brand\/cbg-mark-900\.webp" width="900" height="900" alt=""/);
  });

  it('speaks for the whole institute: IOSH appears only on the IOSH course card', () => {
    const rest = html.replace(sectionHtml(html, 'courses'), '').replace(sectionHtml(html, 'disciplines'), '');
    expect(rest).not.toMatch(/IOSH/);
    expect(html).not.toContain('safety.training@');
    expect(html).toContain('mailto:info@carbonblueglobal.com');
  });

  it('bolds the about highlight when one is given', () => {
    const out = home({ ...h, about: { ...h.about, highlight: 'training arm' } }, courses);
    expect(out).toContain('<strong>training arm</strong>');
  });

  it('escapes every content string', () => {
    const evil = '<script>alert(1)</script>"&\'';
    const bad = mapStrings(h, (s) => (s.startsWith('http') || s.startsWith('mailto') || s.endsWith('.png') ? s : `${s}${evil}`));
    const out = home(bad as Home, courses.map((c) => mapStrings(c, (s) => `${s}${evil}`)) as CourseFile[]);
    expect(out).not.toContain('<script>');
    expect(out).not.toContain(evil);
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;&quot;&amp;&#39;');
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

describe('home facts', () => {
  const facts = sectionHtml(html, 'facts');
  const languages = new Set(courses.flatMap((c) => c.card.languages ?? []));

  it('counts every course file and each card language once, with the counter contract', () => {
    expect(courses.length).toBe(6);
    expect([...languages].sort()).toEqual(['English', 'Malayalam', 'Tamil', 'Telugu']);
    for (const n of [courses.length, languages.size])
      expect(facts).toContain(`<span aria-hidden="true" data-cbg-count="${n}">${n}</span><span class="cbg-sr-only">${n}</span>`);
    expect(facts).toContain(`<b>${h.facts.delivery.value}</b><span>${h.facts.delivery.label}</span>`);
  });

  it('follows the course files', () => {
    const out = sectionHtml(home(h, [...courses, soon('Extra', 50, { languages: ['Hindi', 'English'] })]), 'facts');
    expect(out).toContain(`data-cbg-count="${courses.length + 1}"`);
    expect(out).toContain(`data-cbg-count="${languages.size + 1}"`);
  });

  it('does not take the course page fact grid class', () => expect(facts).not.toMatch(/class="[^"]*\bcbg-facts\b/));
});

describe('home disciplines strip', () => {
  const strip = sectionHtml(html, 'disciplines');

  it('is decorative: hidden from screen readers, nothing focusable', () => {
    expect(strip).toContain('aria-hidden="true"');
    expect(strip).not.toMatch(/<(a|button)\b|tabindex/);
  });

  it('shows every course title, in two identical sets: plain, or split into letters when outlined', () => {
    const plain = OUTLINED ? disciplines(courses.map((c) => c.card)) : strip;
    for (const c of courses) expect(count(plain, new RegExp(`<span>${c.card.title.replace(/[()]/g, '\\$&')}</span>`, 'g'))).toBe(2);
    expect(plain).not.toContain('cbg-strip');
    const outlined = OUTLINED ? strip : disciplines(courses.map((c) => c.card), true);
    expect(outlined).toContain('class="cbg-marquee cbg-strip"');
    const names = [...outlined.matchAll(/<span class="cbg-strip__n">(.*?)<\/span><\/span>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'));
    expect(names).toHaveLength(2 * courses.length);
    for (const c of courses) expect(names.filter((n) => n === c.card.title)).toHaveLength(2);
    expect(count(strip, /class="cbg-marquee__set"/g)).toBe(2);
  });

  it('staggers each title\'s letters from 0 to 0.6 s; spaces stay plain text', () => {
    expect(letters('A B&C')).toBe('<span style="--d:0.00s">A</span> <span style="--d:0.20s">B</span><span style="--d:0.40s">&amp;</span><span style="--d:0.60s">C</span>');
    expect(letters('X')).toBe('<span style="--d:0.00s">X</span>');
  });
});

describe('home course cards', () => {
  const cards = sectionHtml(html, 'courses');
  const articles = cards.match(/<article[^]*?<\/article>/g)!;
  const titles = [...cards.matchAll(/<h3 class="cbg-h3">([^<]+)<\/h3>/g)].map((m) => m[1].replace('&amp;', '&'));

  it('one card per course file, in card order (IOSH first, Interior Design last)', () => {
    expect(titles).toEqual([...courses].sort((a, b) => a.card.order - b.card.order).map((c) => c.card.title));
    expect(titles[0]).toBe('IOSH Level 3 Certificate');
    expect(titles.at(-1)).toBe('Interior Design');
  });

  it('only live cards are links; coming-soon cards have none', () => {
    expect(count(cards, /cbg-course--live/g)).toBe(2);
    expect(count(cards, /cbg-course--soon/g)).toBe(4);
    expect(count(cards, /<a /g)).toBe(2);
    expect(cards).toContain('href="/course/101-iosh-level3-certificate"');
    expect(cards).toContain('href="/course/102-quantity-surveying"');
    for (const card of articles.filter((c) => c.includes('cbg-course--soon')))
      expect(card).not.toMatch(/<a\b/);
  });

  it('the Interior Design placeholder shows only its title and status', () => {
    const card = articles.find((c) => c.includes('>Interior Design<'))!;
    expect(card.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).toBe('coming soon Interior Design');
  });

  it('shows the card photo once built; until then the media box is empty', () => {
    expect(count(cards, /<div class="cbg-course__media" aria-hidden="true"><picture/g)).toBe(courses.length);
    expect(sectionHtml(home(h, [soon('With photo', 1, { image: 'closing-plate' })]), 'courses')).toContain('closing-plate-800.avif');
    expect(sectionHtml(home(h, [soon('No photo', 1, { image: 'not-built-yet' })]), 'courses'))
      .toContain('<div class="cbg-course__media" aria-hidden="true"></div>');
  });

  it("the live card's link names its course for screen readers (copy from the YAML)", () => {
    const live = courses.find((c) => c.card.status === 'live now')!.card;
    expect(cards).toContain(`>${live.cta!.label}<span class="cbg-sr-only">: ${live.title}</span>`);
  });

  it('a card becomes a link when its course goes live, with no template change', () => {
    const first = courses.find((c) => c.card.status === 'live now')!;
    const second: CourseFile = {
      ...first, slug: 'second-course',
      card: { ...first.card, title: 'Second Course Title', cta: { label: 'Open course', href: '/course/202-second' } },
    };
    const out = home(h, [...courses, second]);
    expect(count(out, /class="cbg-card cbg-course /g)).toBe(courses.length + 1);
    expect(out).toContain('Second Course Title');
    expect(out).toContain('href="/course/202-second"');
  });

  it('the row is a labelled, focusable region', () =>
    expect(cards).toContain('<div class="cbg-gallery" role="region" aria-labelledby="cbg-courses-heading" tabindex="0">'));

});

describe('home band', () => {
  it('shows only once its image is built', () => {
    expect(html.includes('id="cbg-band"')).toBe(bandBuilt);
    const out = home({ ...h, band: { image: 'closing-plate', alt: 'A desk' } }, courses);
    expect(sectionHtml(out, 'band')).toMatch(/data-cbg-parallax[^]*closing-plate-1536\.avif/);
    expect(home({ ...h, band: { image: 'not-built-yet', alt: 'A desk' } }, courses)).not.toContain('id="cbg-band"');
    expect(home({ ...h, band: undefined }, courses)).not.toContain('id="cbg-band"');
  });

  it('is the floating desk: one labelled picture, three sized cut-outs that react to the pointer', () => {
    const band = sectionHtml(html, 'band');
    expect(band).toContain(`role="img" aria-label="${h.band!.alt}"`);
    expect(band).toContain('data-cbg-desk');
    for (const name of ['plans', 'laptop', 'helmet']) {
      expect(band).toMatch(new RegExp(`cbg-desk__obj--${name}" data-cbg-desk-object data-depth="[0-9.]+" data-spin="[yz]"`));
      expect(band).toMatch(new RegExp(`band-desk/${name}-[0-9]+[.]avif [0-9]+w`));
    }
    expect(band.match(/<img [^>]*width="\d+" height="\d+" alt=""/g)!.length).toBe(4); // the photo and three cut-outs, all sized
  });
});
