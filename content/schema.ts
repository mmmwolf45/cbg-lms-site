import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';

// A shape says what each YAML key must hold:
// 'string' | 'number' | 'boolean' | [shape] (a list of shape) | { key: shape }.
// A key ending in '?' is optional. Any key not listed is an error (catches typos).
type Shape = 'string' | 'number' | 'boolean' | readonly [Shape] | { readonly [key: string]: Shape };

type Infer<S> = S extends 'string' ? string
  : S extends 'number' ? number
  : S extends 'boolean' ? boolean
  : S extends readonly [infer E] ? Infer<E>[]
  : Flat<{ [K in keyof S as K extends `${string}?` ? never : K]: Infer<S[K]> }
    & { [K in keyof S as K extends `${infer N}?` ? N : never]?: Infer<S[K]> }>;
type Flat<T> = { [K in keyof T]: T[K] } & {};

const s = 'string';
const link = { label: s, href: s } as const;
const cta = { label: s, 'action?': s, 'href?': s } as const;
const whatsapp = { label: s, number: s, href: s } as const;
const email = { label: s, address: s, href: s } as const;
const titled = { title: s, body: s } as const;
// A logo: the source file in brand/assets/ (src/components/html.ts maps it to the published one) and its alt text.
const logos = [{ file: s, alt: s }] as const;

const homeShape = {
  hero: { eyebrow: s, heading: s, subhead: s, primaryCta: cta, secondaryCta: whatsapp, imageAlt: s },
  // Three facts under the hero. The course and language numbers are counted from content/courses/*.yaml
  // at build time (every course file; the languages listed on the cards, each counted once), so only
  // their labels live here. `delivery` is shown as written.
  facts: { courses: s, languages: s, delivery: { value: s, label: s } },
  // The slow strip of course titles. Its words come from the course cards, so it has no copy of its own.
  disciplines: {},
  'how-it-works': { heading: s, steps: [titled] },
  // A full-width photo band. `image` is a name from src/images.json; the band is left out until
  // `npm run images` has built it.
  'band?': { image: s },
  courses: { heading: s, intro: s },
  support: { heading: s, body: s, whatsapp, emails: [email] },
  about: { heading: s, body: s, 'highlight?': s, logos, link },
  'footer-note': { text: s },
} as const;

// A home page course card. `status` is "live now" or "coming soon" (checkCard): a live card needs `cta`
// and becomes a link; a coming-soon card has none. `line` is the course description, `meta` the chips,
// `languages` and `duration` the course facts (the languages feed the home page count). `image` is a
// name from src/images.json (a navy placeholder shows until it is built). Cards sort by `order`.
const cardShape = {
  title: s, status: s, 'tag?': s, 'line?': s, 'meta?': [s],
  'languages?': [s], 'duration?': s, 'image?': s, order: 'number', 'cta?': link,
} as const;

// Every section except `hero` is optional: a course shows only the sections its YAML has, in this order.
const courseShape = {
  slug: s,
  uniqueId: s,
  path: s,
  card: cardShape, // the home page course card
  hero: {
    eyebrow: s, heading: s, subhead: s,
    // The picture under the CTA (checkHero): 'hazard-scan' (needs `image`, `imageAlt`, `hazards`, `tour`),
    // 'photo' (needs `image`, `imageAlt`) or 'none'. `image` is a name from src/images.json.
    visual: s, 'image?': s, 'imageAlt?': s,
    facts: [{ value: s, 'label?': s, 'count?': 'number', 'prefix?': s }],
    cta,
    // Hazard Scan: `at` is the marker point [x, y] and `zoom` the phone-tour area [x, y, w, h], in source
    // pixels of the hero image, checked in checkHero.
    'hazards?': [{ label: s, detail: s, at: ['number'], zoom: ['number'] }],
    'tour?': { previous: s, next: s }, // the phone tour's step buttons
  },
  'included?': { heading: s, intro: s, cards: [{ ...titled, 'featured?': 'boolean' }] },
  'units?': {
    heading: s, intro: s,
    // The hours wording: `hoursLabel` under the total and beside each unit's hours (default
    // "guided learning hours"), `hoursShort` on the building drawing's floors (default "GLH").
    'hoursLabel?': s, 'hoursShort?': s,
    units: [{ code: s, title: s, glh: 'number', outcomes: [s], sessions: [{ id: s, title: s }] }],
  },
  'how-classes-run?': { heading: s, items: [titled], timetable: { label: s, text: s } },
  'assessment?': {
    heading: s, intro: s,
    assessments: [{
      label: s, title: s, points: [s],
      'tasksIntro?': s, 'tasks?': [{ name: s, marks: 'number' }], 'tasksNote?': s,
    }],
    'techIoshNote?': s, // the closing callout under the assessments
  },
  'trainers?': { heading: s, trainers: [{ name: s, role: s, photo: s, bio: s, credentials: [s] }] },
  'bonus?': { heading: s, intro: s, steps: [titled], smallPrint: s },
  'field-guides?': {
    heading: s, body: s,
    releasedLabel: s, released: [{ label: s, title: s, 'subtitle?': s }],
    upcomingLabel: s, upcoming: [s], unnamedUpcoming: 'number', comingSoonLabel: s,
  },
  'payments?': { heading: s, body: s },
  'faq?': { heading: s, items: [{ q: s, a: s }] },
  // `image`: the closing band's background, a name from src/images.json (default "closing-plate").
  'help?': { heading: s, 'image?': s, whatsapp, email, logos },
} as const;

export const HERO_VISUALS = ['hazard-scan', 'photo', 'none'] as const;
export const CARD_STATUSES = ['live now', 'coming soon'] as const;
export type Home = Infer<typeof homeShape>;
export type Card = Infer<typeof cardShape>;
// A course with its own page (hero and the other sections).
export type Course = Infer<typeof courseShape> & { hero: { visual: (typeof HERO_VISUALS)[number] } };
// A course that only has a home page card for now (no page sections, "coming soon").
export type CardOnly = { slug: string; card: Card };
export type CourseFile = Course | CardOnly;
export const hasPage = (c: CourseFile): c is Course => 'hero' in c;
// The keys of a card-only course file.
const cardOnlyShape = { slug: s, card: cardShape } as const;
// One course section's data, for a course that has it (e.g. Section<'units'>).
export type Section<K extends keyof Course> = NonNullable<Course[K]>;

// Section ids in page order (used as id="cbg-<section>").
export const homeSections = Object.keys(homeShape).map((k) => k.replace(/\?$/, '')) as (keyof Home)[];
export const courseSections = Object.keys(courseShape).map((k) => k.replace(/\?$/, ''))
  .filter((k) => !['slug', 'uniqueId', 'path', 'card'].includes(k)) as (keyof Course)[];

const EM_DASH = String.fromCharCode(0x2014);
// Every `href` in the content: an https: or mailto: link, an in-page #anchor, or a site path ("/course/...",
// but not "//host", which is another site). Anything else (http:, javascript:, a bare word) is an error.
const HREF = /^(https:\/\/|mailto:|#|\/(?!\/))/;

function check(value: unknown, shape: Shape, path: string, file: string): void {
  const fail = (msg: string): never => { throw new Error(`${file}: ${path || '(top)'}: ${msg}`); };
  if (typeof shape === 'string') {
    if (typeof value !== shape) fail(`expected ${shape}, got ${JSON.stringify(value)}`);
    if (typeof value === 'string' && !value.trim()) fail('is empty');
    if (typeof value === 'string' && value.includes(EM_DASH)) fail('contains an em-dash (U+2014); use a comma, colon or full stop');
    if (/(^|\.)href$/.test(path) && !HREF.test(value as string)) fail(`must start with https://, mailto:, # or /, got ${JSON.stringify(value)}`);
    return;
  }
  if (Array.isArray(shape)) {
    if (!Array.isArray(value)) return fail('expected a list');
    value.forEach((item, i) => check(item, shape[0], `${path}[${i}]`, file));
    return;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail('expected a set of keys');
  const obj = value as Record<string, unknown>;
  const at = (key: string) => (path ? `${path}.${key}` : key);
  for (const key of Object.keys(obj)) {
    if (!(key in shape) && !(`${key}?` in shape)) {
      throw new Error(`${file}: ${at(key)}: ${path ? 'unknown key' : 'unknown section id'}`);
    }
  }
  for (const [key, sub] of Object.entries(shape as Record<string, Shape>)) {
    const name = key.replace(/\?$/, '');
    if (obj[name] === undefined || obj[name] === null) {
      if (key.endsWith('?')) continue;
      throw new Error(`${file}: ${at(name)}: missing ${path ? 'field' : 'section'}`);
    }
    check(obj[name], sub, at(name), file);
  }
}

export function validateHome(data: unknown, file = 'content/home.yaml'): Home {
  check(data, homeShape, '', file);
  return data as Home;
}

// The built pictures and their source sizes (written by `npm run images`). Read, not imported, because
// Playwright loads this file too and needs an import attribute for JSON.
const images: Record<string, { width: number; height: number }> =
  JSON.parse(readFileSync(new URL('../src/images.json', import.meta.url), 'utf8'));

// A picture name the YAML gives must be one `npm run images` built.
function checkImage(name: string, path: string, file: string) {
  if (!(name in images)) throw new Error(`${file}: ${path}: no image "${name}" in src/images.json (add it to scripts/images.ts, then npm run images)`);
}

// Each hero visual's fields are required for it and refused for the others (no silently unused copy).
// Hazard Scan: the image must be 3:2 (it shows uncropped in course.css's 3:2 box, so x% of the photo is
// x% of the box) and every marker point and zoom area must be whole-photo numbers inside it.
function checkHero({ hero: h }: Course, file: string) {
  const fail = (msg: string): never => { throw new Error(`${file}: hero.${msg}`); };
  if (!HERO_VISUALS.includes(h.visual)) fail(`visual: must be ${HERO_VISUALS.join(', ')}; got ${JSON.stringify(h.visual)}`);
  const scan = h.visual === 'hazard-scan';
  const needs = { image: h.visual !== 'none', imageAlt: h.visual !== 'none', hazards: scan, tour: scan };
  for (const [key, needed] of Object.entries(needs)) {
    const has = h[key as keyof typeof needs] !== undefined;
    if (needed && !has) fail(`${key}: missing field (visual: ${h.visual} needs it)`);
    if (!needed && has) fail(`${key}: not used with visual: ${h.visual}; remove it`);
  }
  if (h.image) checkImage(h.image, 'hero.image', file);
  if (!h.image || !h.hazards) return;
  if (!h.hazards.length) fail('hazards: list at least one hazard (or use visual: photo)');
  const { width: W, height: H } = images[h.image];
  if (W * 2 !== H * 3) fail(`image: the Hazard Scan photo must be 3:2; "${h.image}" is ${W}x${H}`);
  h.hazards.forEach(({ at, zoom }, i) => {
    const [x, y, w, ht] = zoom;
    if (at.length !== 2 || !(at[0] >= 0 && at[0] <= W && at[1] >= 0 && at[1] <= H)) fail(`hazards[${i}].at: must be [x, y] inside ${W}x${H}`);
    if (zoom.length !== 4 || !(x >= 0 && y >= 0 && w > 0 && ht > 0 && x + w <= W && y + ht <= H)) fail(`hazards[${i}].zoom: must be [x, y, w, h] inside ${W}x${H}`);
  });
}

// On a laptop the field-guide shelf is one fanned row in the 788px column (course.css): released covers
// 152px wide, upcoming ones 116px, each cover after the first in its group overlapping the one before by
// 32px, 16px between the two groups. A shelf wider than the column would spill onto the enrol card.
function checkShelf({ 'field-guides': g }: Course, file: string) {
  if (!g) return;
  const r = g.released.length;
  const u = g.upcoming.length + g.unnamedUpcoming;
  const width = (r && 152 + 120 * (r - 1)) + (r && u && 16) + (u && 116 + 84 * (u - 1));
  if (width > 788) throw new Error(`${file}: field-guides: ${r} released + ${u} upcoming covers are ${width}px wide on a laptop, more than the 788px column; list fewer`);
}

// Live cards link to their page (`cta` needed); coming-soon cards are not links (`cta` refused, so no
// silently unused copy). A course file with no page sections can only be coming soon.
function checkCard(c: Card, file: string, page: boolean) {
  const fail = (msg: string): never => { throw new Error(`${file}: card.${msg}`); };
  if (!CARD_STATUSES.includes(c.status as (typeof CARD_STATUSES)[number])) fail(`status: must be ${CARD_STATUSES.join(' or ')}; got ${JSON.stringify(c.status)}`);
  if (!page && c.status !== 'coming soon') fail('status: a course file with no page sections must be "coming soon"');
  if (c.status === 'live now' && !c.cta) fail('cta: missing field (a live card links to its course page)');
  if (c.status === 'coming soon' && c.cta) fail('cta: not used while the course is coming soon; remove it');
}

export function validateCourse(data: unknown, file = 'content/courses/(course).yaml'): Course {
  check(data, courseShape, '', file);
  const c = data as Course;
  checkCard(c.card, file, true);
  checkHero(c, file);
  checkShelf(c, file);
  if (c.help?.image) checkImage(c.help.image, 'help.image', file);
  return c;
}

function read(rel: string, file: string): unknown {
  try {
    return parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
  } catch (e) {
    throw new Error(`${file}: ${(e as Error).message}`);
  }
}

export const loadHome = () => validateHome(read('./home.yaml', 'content/home.yaml'));

// A course file is card-only when it has nothing but `slug` and `card`; anything else is a full page.
export function validateCourseFile(data: unknown, file = 'content/courses/(course).yaml'): CourseFile {
  const keys = data && typeof data === 'object' ? Object.keys(data) : [];
  if (keys.some((k) => k !== 'slug' && k !== 'card')) return validateCourse(data, file);
  check(data, cardOnlyShape, '', file);
  const c = data as CardOnly;
  checkCard(c.card, file, false);
  return c;
}

// One course file, e.g. loadCourseFile('bim.yaml'). Its slug must match the file name.
export function loadCourseFile(name: string): CourseFile {
  const file = `content/courses/${name}`;
  const course = validateCourseFile(read(`./courses/${name}`, file), file);
  if (course.slug !== name.slice(0, -5)) throw new Error(`${file}: slug: must match the file name ("${name.slice(0, -5)}")`);
  return course;
}

// One course with a page, e.g. loadCourse('_dummy.yaml').
export function loadCourse(name: string): Course {
  const c = loadCourseFile(name);
  if (!hasPage(c)) throw new Error(`content/courses/${name}: has no page sections (card only)`);
  return c;
}

// Every content/courses/*.yaml except files starting with "_" (drafts, examples such as _dummy.yaml).
export function loadCourseFiles(): CourseFile[] {
  return readdirSync(new URL('./courses/', import.meta.url))
    .filter((f) => f.endsWith('.yaml') && !f.startsWith('_'))
    .sort()
    .map(loadCourseFile);
}

// The courses that have a page (built into <slug>-top and <slug>-main blocks).
export const loadCourses = (): Course[] => loadCourseFiles().filter(hasPage);
