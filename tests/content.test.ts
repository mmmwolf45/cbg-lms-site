import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { loadCourseFiles, loadCourses, loadHome, validateCourse, validateCourseFile, validateHome } from '../content/schema';

const EM_DASH = String.fromCharCode(0x2014);
const yaml = (file: string) => parse(readFileSync(file, 'utf8'));
const home = () => yaml('content/home.yaml');
const course = () => yaml('content/courses/iosh-level-3.yaml');

describe('content schema', () => {
  it('accepts both YAML files', () => {
    expect(Object.keys(loadHome())).toEqual(['hero', 'facts', 'disciplines', 'how-it-works', 'band', 'courses', 'support', 'about', 'footer-note']);
    expect(loadCourses().map((c) => c.slug)).toEqual(['iosh-level-3', 'quantity-surveying']);
    expect(loadCourseFiles().map((c) => c.slug)).toEqual(['bim', 'interior-design', 'iosh-level-3', 'mep-design', 'quantity-surveying', 'structural-design']);
  });

  it('rejects a missing section', () => {
    const d = home();
    delete d.support;
    expect(() => validateHome(d)).toThrow('content/home.yaml: support: missing section');
    const c = course();
    delete c.hero;
    expect(() => validateCourse(c)).toThrow('hero: missing section');
  });

  it('rejects a missing field', () => {
    const d = home();
    delete d.support.whatsapp.href;
    expect(() => validateHome(d)).toThrow('support.whatsapp.href: missing field');
  });

  it('rejects an em-dash anywhere', () => {
    const d = home();
    d.hero.eyebrow = `Carbon Blue ${EM_DASH} Training Institute`;
    expect(() => validateHome(d)).toThrow(/hero\.eyebrow: contains an em-dash/);
    const c = course();
    c.faq.items[3].a += EM_DASH;
    expect(() => validateCourse(c)).toThrow(/faq\.items\[3\]\.a: contains an em-dash/);
  });

  it('rejects an unknown section id', () => {
    const d = home();
    d.testimonials = { heading: 'x' };
    expect(() => validateHome(d)).toThrow('testimonials: unknown section id');
  });

  it('rejects an href that is not https:, mailto:, #anchor or a site path', () => {
    for (const bad of ['http://wa.me/97470485638', 'javascript:alert(1)', '//evil.example/x', 'www.carbonblueglobal.com']) {
      const d = home();
      d.about.link.href = bad;
      expect(() => validateHome(d)).toThrow(`about.link.href: must start with https://, mailto:, # or /, got "${bad}"`);
    }
    const c = course();
    c.card.cta.href = 'ftp://x';
    expect(() => validateCourse(c)).toThrow('card.cta.href: must start with');
    c.card.cta.href = '/course/101-iosh-level3-certificate';
    c.hero.cta.href = '#course_content';
    c.help.email.href = 'mailto:safety.training@carbonblueglobal.com';
    expect(() => validateCourse(c)).not.toThrow();
  });

  it('rejects a wrong type', () => {
    const c = course();
    c.units.units[0].glh = '21';
    expect(() => validateCourse(c)).toThrow('units.units[0].glh: expected number');
  });

  it('checks the build scrub: two or more whole frames, every take-off point inside the scrub', () => {
    const qs = () => yaml('content/courses/quantity-surveying.yaml');
    for (const count of [1, 2.5]) {
      const c = qs();
      c.hero.scrub.count = count;
      expect(() => validateCourse(c)).toThrow(`hero.scrub.count: must be a whole number of frames, 2 or more; got ${count}`);
    }
    for (const at of [-0.1, 1.2]) {
      const c = qs();
      c.hero.scrub.takeoff[1].at = at;
      expect(() => validateCourse(c)).toThrow(`hero.scrub.takeoff[1].at: must be 0..1 (of the scrub); got ${at}`);
    }
  });
});

// A course file is a full page (as iosh-level-3.yaml) or card only (just `slug` and `card`, coming soon).
describe('course files', () => {
  const cardOnly = () => yaml('content/courses/bim.yaml');

  it('accepts a card-only file and keeps it off the page builds', () => {
    expect(validateCourseFile(cardOnly())).toEqual(cardOnly());
    expect(loadCourses().some((c) => c.slug === 'bim')).toBe(false);
  });

  it('a card-only file is coming soon and has no link', () => {
    const c = cardOnly();
    c.card.status = 'live now';
    expect(() => validateCourseFile(c)).toThrow('card.status: a course file with no page sections must be "coming soon"');
    const d = cardOnly();
    d.card.cta = { label: 'Open course', href: '/course/1-x' };
    expect(() => validateCourseFile(d)).toThrow('card.cta: not used while the course is coming soon; remove it');
  });

  it('a status is live now or coming soon; a live card needs its link', () => {
    const c = course();
    c.card.status = 'soon';
    expect(() => validateCourse(c)).toThrow('card.status: must be live now or coming soon; got "soon"');
    const d = course();
    delete d.card.cta;
    expect(() => validateCourse(d)).toThrow('card.cta: missing field (a live card links to its course page)');
  });

  it('needs a card order; any other top-level key makes it a full page', () => {
    const c = cardOnly();
    delete c.card.order;
    expect(() => validateCourseFile(c)).toThrow('card.order: missing field');
    const d = cardOnly();
    d.uniqueId = '202';
    expect(() => validateCourseFile(d)).toThrow('path: missing section');
  });
});

// Every copy sentence in the original copy deck must appear in the YAML, word for word.
// Editorial notes (not shown to students) are skipped, as listed at the top of each YAML file.
const EDITORIAL_LINE = /^\s*(?:-\s*)?\*\*(Audience|Rules|Sources|Visual idea|Template note|Logos|Small logos|Photos|Page):\*\*/;
const EDITORIAL_BLOCK = /\*\*(Rules|Sources):\*\*/; // the list under these is skipped too
const EDITORIAL_PARA = /^(The course\.link header|The native course\.link header|A short checklist, with ticks)/;
const NOT_COPY: (string | RegExp)[] = [
  /^Unit \d+$/, /^\d+ GLH$/, /^Card \d+$/, // shown from data (position, glh number)
  'Three steps, numbered', 'the course.link login', 'If logged in', 'Go to my courses', "the user's courses",
  'button opens WhatsApp', "We're here to help", 'Small print', 'plus two more',
  'Course at a glance', 'first custom section in the main column', "What's included", 'The four units',
  'Your four bonus certificates', 'CBG Field Guides', 'Help and contacts', 'closing band',
  'It scrolls to #course_content and opens its first accordion item', 'Start Here',
  'found by position or text, never by Radix id',
];
// Removed from the home page on purpose on 3 Oct 2026 (Maasoom: the home page speaks for the whole
// institute; IOSH content belongs on the IOSH course page). See the note at the top of content/home.yaml.
const REMOVED = [
  'welcome guide, class links, slides, bonus certificate guides and more', // now "slides and more"
  'Before your first class', 'Log in here and open your course', 'Read the "Start Here" lessons on your course page',
  'Join the introduction session', 'Download your CBG Field Guides', 'Set up your bonus certificate accounts',
  'start with IBM SkillsBuild', // the first-steps checklist
  'As an IOSH Approved Study Centre',
  'CBG brings live-project experience into professional qualifications, taught by practitioners who have run safety on real sites',
];
NOT_COPY.push(...REMOVED);
const notCopy = (f: string) => NOT_COPY.some((n) => (typeof n === 'string' ? n === f : n.test(f)));

function copyFragments(md: string): string[] {
  const out: string[] = [];
  let inBlock = false;
  for (const raw of md.split(/\r?\n/)) {
    if (!raw.trim()) { inBlock = false; continue; }
    if (inBlock || raw.startsWith('# ') || raw.startsWith('---')) continue;
    if (EDITORIAL_LINE.test(raw)) { inBlock = EDITORIAL_BLOCK.test(raw); continue; }
    const line = raw
      .replace(/^\s*(?:-|\d+\.)\s+/, '')
      .replace(/^## \[[\w-]+\]\s*/, '')
      .replace(/\*\*[^*]+:\*\*/g, '') // bold labels such as **Heading:**
      .replaceAll('**', '')
      .replaceAll('`', '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'); // a Markdown link counts as its text (the URL is checked as an href)
    if (EDITORIAL_PARA.test(line)) continue;
    for (const part of line.split(/(?<=[.?!])\s+|\s*[·→]\s+|:\s|\(|\)|;\s/)) {
      const f = part.replace(/\s+/g, ' ').replace(/^[\s"',.:]+|[\s"',.:]+$/g, '');
      if (f && !notCopy(f)) out.push(f);
    }
  }
  return out;
}

function strings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === 'object') return Object.values(v).flatMap(strings);
  return [];
}

describe('copy deck coverage', () => {
  const haystack = strings([home(), course()]).join(' ').replace(/\s+/g, ' ');
  // A list such as "a, b, c" may be split into separate YAML items, so each part is checked; a listed name can
  // become a capitalised title there ("industry mentor circles" -> "Industry mentor circles."), so parts are
  // compared case-insensitively. Whole sentences stay exact.
  const lower = haystack.toLowerCase();
  const found = (f: string) => haystack.includes(f)
    || f.split(', ').every((p) => notCopy(p) || lower.includes(p.replace(/^"|"$/g, '').toLowerCase()));

  for (const md of ['docs/copy-deck/home.md', 'docs/copy-deck/courses/iosh-level-3.md']) {
    it(`every sentence in ${md} is in the YAML`, () => {
      const fragments = copyFragments(readFileSync(md, 'utf8'));
      expect(fragments.length).toBeGreaterThan(40); // the parser still finds the copy (48 home fragments after the 3 Oct removals)
      expect(fragments.filter((f) => !found(f))).toEqual([]);
    });
  }
});
