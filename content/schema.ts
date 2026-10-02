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
  'how-it-works': { heading: s, steps: [titled] },
  courses: { heading: s, intro: s },
  'first-steps': { heading: s, items: [s] },
  support: { heading: s, body: s, whatsapp, emails: [email] },
  about: { heading: s, body: s, 'highlight?': s, logos, link },
  'footer-note': { text: s },
} as const;

const courseShape = {
  slug: s,
  uniqueId: s,
  path: s,
  card: { title: s, status: s, tag: s, line: s, meta: [s], cta: link },
  hero: {
    eyebrow: s, heading: s, subhead: s, imageAlt: s,
    facts: [{ value: s, 'label?': s, 'count?': 'number', 'prefix?': s }],
    cta,
    // Hazard Scan: `at` is the marker point [x, y] and `zoom` the phone-tour area [x, y, w, h], in source
    // pixels of the hazard-worksite photo (HAZARD_PHOTO), checked in validateCourse.
    hazards: [{ label: s, detail: s, at: ['number'], zoom: ['number'] }],
    tour: { previous: s, next: s }, // the phone tour's step buttons
  },
  included: { heading: s, intro: s, cards: [{ ...titled, 'featured?': 'boolean' }] },
  units: {
    heading: s, intro: s,
    units: [{ code: s, title: s, glh: 'number', outcomes: [s], sessions: [{ id: s, title: s }] }],
  },
  'how-classes-run': { heading: s, items: [titled], timetable: { label: s, text: s } },
  assessment: {
    heading: s, intro: s,
    assessments: [{
      label: s, title: s, points: [s],
      'tasksIntro?': s, 'tasks?': [{ name: s, marks: 'number' }], 'tasksNote?': s,
    }],
    techIoshNote: s,
  },
  trainers: { heading: s, trainers: [{ name: s, role: s, photo: s, bio: s, credentials: [s] }] },
  bonus: { heading: s, intro: s, steps: [titled], smallPrint: s },
  'field-guides': {
    heading: s, body: s,
    releasedLabel: s, released: [{ label: s, title: s, 'subtitle?': s }],
    upcomingLabel: s, upcoming: [s], unnamedUpcoming: 'number', comingSoonLabel: s,
  },
  payments: { heading: s, body: s },
  faq: { heading: s, items: [{ q: s, a: s }] },
  help: { heading: s, whatsapp, email, logos },
} as const;

export type Home = Infer<typeof homeShape>;
export type Course = Infer<typeof courseShape>;

// Section ids in page order (used as id="cbg-<section>").
export const homeSections = Object.keys(homeShape) as (keyof Home)[];
export const courseSections = Object.keys(courseShape)
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

// Source size of brand/assets/photos/hazard-worksite.png (src/images.json).
export const HAZARD_PHOTO = [1536, 1024] as const;

// Each hazard's marker point and zoom area must be whole-photo numbers inside the frame.
function checkHazards(c: Course, file: string) {
  const [W, H] = HAZARD_PHOTO;
  c.hero.hazards.forEach(({ at, zoom }, i) => {
    const fail = (msg: string): never => { throw new Error(`${file}: hero.hazards[${i}].${msg}`); };
    const [x, y, w, h] = zoom;
    if (at.length !== 2 || !(at[0] >= 0 && at[0] <= W && at[1] >= 0 && at[1] <= H)) fail(`at: must be [x, y] inside ${W}x${H}`);
    if (zoom.length !== 4 || !(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= W && y + h <= H)) fail(`zoom: must be [x, y, w, h] inside ${W}x${H}`);
  });
}

export function validateCourse(data: unknown, file = 'content/courses/(course).yaml'): Course {
  check(data, courseShape, '', file);
  checkHazards(data as Course, file);
  return data as Course;
}

function read(rel: string, file: string): unknown {
  try {
    return parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
  } catch (e) {
    throw new Error(`${file}: ${(e as Error).message}`);
  }
}

export const loadHome = () => validateHome(read('./home.yaml', 'content/home.yaml'));

// Every content/courses/*.yaml except files starting with "_" (drafts, examples).
export function loadCourses(): Course[] {
  return readdirSync(new URL('./courses/', import.meta.url))
    .filter((f) => f.endsWith('.yaml') && !f.startsWith('_'))
    .sort()
    .map((f) => {
      const file = `content/courses/${f}`;
      const course = validateCourse(read(`./courses/${f}`, file), file);
      if (course.slug !== f.slice(0, -5)) throw new Error(`${file}: slug: must match the file name ("${f.slice(0, -5)}")`);
      return course;
    });
}
