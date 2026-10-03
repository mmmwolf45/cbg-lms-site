import { describe, expect, it } from 'vitest';
import { loadCourse, validateCourse, type Course, type Section } from '../content/schema';
import { courseMain } from '../templates/course';
import { certificates } from '../templates/sections/course-certificates';
import { trainers, initials } from '../templates/sections/course-trainers';
import { testimonials } from '../templates/sections/course-testimonials';
import { placements } from '../templates/sections/course-placements';
import { careers } from '../templates/sections/course-careers';
import { travel } from '../src/motion/qs-sections';
import images from '../src/images.json';

// The QS sections from fixtures (the real QS YAML is written separately): markup, escaping, fallbacks
// and the accessibility hooks.
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const EVIL = '<b>"x"&\'</b>';
const ESCAPED = '&lt;b&gt;&quot;x&quot;&amp;&#39;&lt;/b&gt;';

const certs: Section<'certificates'> = {
  heading: 'Your certificates: two of them', intro: 'Earned on the course.',
  certs: [
    { title: 'Course certificate', body: 'Issued by CBG.' },
    { title: 'Project certificate', body: 'For the live project.' },
  ],
  rulesLabel: 'To earn them', rules: ['Attend 80% of classes', 'Submit every assignment', 'Pass the final test'],
};

const person = (i: number) => ({ name: `Learner ${String.fromCharCode(65 + (i % 26))}${i}`, role: 'Quantity Surveyor' });
const faculty = (n: number): Section<'trainers'> => ({
  heading: 'Your faculty', intro: 'Thirteen working surveyors.',
  trainers: Array.from({ length: n }, (_, i) => ({ name: `Trainer ${i} Name`, role: 'Senior QS', bio: 'Twelve years on Gulf projects.' })),
});

describe('certificates', () => {
  const html = certificates(certs);

  it('renders every card with our drawn sheet (decorative)', () => {
    expect(count(html, /class="cbg-card cbg-cert"/g)).toBe(2);
    expect(count(html, /class="cbg-cert__sheet cbg-cert__sheet--drawn"/g)).toBe(2);
    expect(html).toContain('<div class="cbg-cert__desk" aria-hidden="true"><div class="cbg-cert__sheet cbg-cert__sheet--drawn"><b>Project certificate</b>');
    expect(html).toContain('<ul class="cbg-certs" data-cbg-reveal="stagger">');
  });

  it('lists the rules as a checklist under their own h3', () => {
    const rules = html.match(/<div class="cbg-rules" data-cbg-reveal>([\s\S]*?)<\/div>/)![1];
    expect(rules).toContain('<h3 class="cbg-h3">To earn them</h3>');
    expect(count(rules, /<li>/g)).toBe(3);
    expect(rules).toContain('<ul class="cbg-ticks">');
  });

  it('leaves the rules out unless both the label and the rules are given (QS has none)', () => {
    expect(certificates({ ...certs, rulesLabel: undefined, rules: undefined })).not.toContain('cbg-rules');
    expect(certificates({ ...certs, rules: undefined })).not.toContain('cbg-rules');
  });

  it('seals the drawn sheet with the CBG mark', () => {
    expect(html).toMatch(/<b>Project certificate<\/b><img class="cbg-cert__seal" src="https:\/\/mmmwolf45\.github\.io\/cbg-lms-site\/brand\/cbg-mark-160\.png"[^>]* alt=""/);
  });

  it('escapes its copy', () => {
    const out = certificates({ ...certs, rulesLabel: EVIL, rules: [EVIL], certs: [{ title: EVIL, body: EVIL }] });
    expect(out).not.toContain(EVIL);
    expect(count(out, new RegExp(ESCAPED, 'g'))).toBe(5); // title (sheet and h3), body, rules label, rule
  });
});

describe('trainers', () => {
  it('keeps the short list as large cards (IOSH)', () => {
    const iosh = loadCourse('iosh-level-3.yaml').trainers!;
    const html = trainers(iosh);
    expect(html).toContain('<ul class="cbg-trainers" data-cbg-reveal="stagger">');
    expect(html).not.toMatch(/cbg-mono|cbg-trainers--grid/);
    expect(count(html, /<div class="cbg-trainer__photo"><picture>/g)).toBe(iosh.trainers.length);
    expect(html).toContain('sizes="112px"');
  });

  it('puts a long faculty in the compact grid, with the intro under the heading', () => {
    const html = trainers(faculty(13));
    expect(html).toContain('<ul class="cbg-trainers cbg-trainers--grid" data-cbg-reveal="stagger">');
    expect(count(html, /class="cbg-card cbg-trainer"/g)).toBe(13);
    expect(html).toContain('<p>Thirteen working surveyors.</p>');
  });

  it('shows initials without a photo, or while the named photo is not built yet', () => {
    const f = faculty(6);
    const photos = ['ali-orkkatteri.jpg', 'not-built-yet.jpg']; // built, not built yet
    const html = trainers({ ...f, trainers: f.trainers.map((t, i) => ({ ...t, photo: photos[i] })) });
    expect(count(html, /<picture>/g)).toBe(1);
    expect(html).toContain('sizes="64px"');
    expect(count(html, /<span class="cbg-mono" aria-hidden="true">TN<\/span>/g)).toBe(5);
  });

  it('lists credentials only when there are some', () => {
    const f = faculty(1);
    expect(trainers(f)).not.toContain('cbg-points');
    const withCreds = { ...f, trainers: [{ ...f.trainers[0]!, credentials: ['MRICS', 'BSc QS'] }] };
    expect(count(trainers(withCreds), /<ul class="cbg-points"><li>MRICS<\/li><li>BSc QS<\/li><\/ul>/g)).toBe(1);
  });

  it('makes initials from the first and last words, letters only', () => {
    expect(initials('Ramshad KK')).toBe('RK');
    expect(initials('elman  aloysius')).toBe('EA');
    expect(initials('Mohammed Ali Orkkatteri')).toBe('MO');
    expect(initials('Shafeer')).toBe('S');
    expect(initials('(Dr.) Nidha P')).toBe('DP');
  });
});

describe('testimonials', () => {
  const s: Section<'testimonials'> = {
    heading: 'In their words', intro: 'Learners, word for word.',
    quotes: [
      { name: 'Rinsha K', role: 'QS, Dubai', text: 'The classes were clear and practical.' },
      { name: 'Jubair M', photo: 'missing.jpg', text: 'I got placed in two months.' },
    ],
    smallPrint: 'Shared with permission.',
  };
  const html = testimonials(s);

  it('quotes each learner word for word in a figure, the list inside a labelled swipe region', () => {
    expect(html).toContain('<div class="cbg-quotes" tabindex="0" role="region" aria-label="In their words"><ul data-cbg-reveal="stagger">');
    expect(count(html, /<figure class="cbg-quote">/g)).toBe(2);
    expect(html).toContain('<blockquote><p>The classes were clear and practical.</p></blockquote>');
    expect(html).toContain('<b>Rinsha K</b><span>QS, Dubai</span>');
    expect(html).toContain('<b>Jubair M</b></span>'); // no role
    expect(count(html, /class="cbg-mono" aria-hidden="true"/g)).toBe(2); // no built photos
    expect(html).toContain('<p class="cbg-small cbg-fine">Shared with permission.</p>');
    expect(testimonials({ ...s, smallPrint: undefined })).not.toContain('cbg-fine');
  });

  it('shows a built learner photo as one small lazy WebP image', () => {
    const out = testimonials({ ...s, quotes: [{ name: 'Abhirami P A', photo: 'abhirami-p-a.jpg', text: 'Good.' }] });
    const img = out.match(/<img class="cbg-face"[^>]*>/)![0];
    const { width, height, variants } = images['student-abhirami-p-a'];
    // The one 80px WebP (sharp at 2x of the 40px avatar), and no srcset (block size).
    expect(variants.webp.map((v) => v.w)).toEqual([80]);
    expect(img).toContain(`src="https://mmmwolf45.github.io/cbg-lms-site/${variants.webp[0]!.file}"`);
    expect(img).not.toContain('srcset');
    expect(img).toContain(`width="${width}" height="${height}" alt="" loading="lazy"`);
    expect(out).not.toContain('cbg-mono');
  });

  it('escapes its copy', () => {
    const out = testimonials({ ...s, heading: EVIL, quotes: [{ name: EVIL, role: EVIL, text: EVIL }] });
    expect(out).not.toContain(EVIL);
    expect(count(out, new RegExp(ESCAPED, 'g'))).toBe(5); // h2 (two-tone splits nothing here), aria-label, text, name, role
  });
});

describe('placements', () => {
  const s = (n: number): Section<'placements'> => ({
    heading: 'Where they work now', intro: 'Placed after the course.',
    people: Array.from({ length: n }, (_, i) => (i === 0 ? { ...person(i), company: 'Gulf Build LLC' } : person(i))),
    note: 'Roles at the time of placement.',
  });

  it('keeps every person in one real list (the drift rows are copies made by JS)', () => {
    const html = placements(s(57));
    const list = html.match(/<ul class="cbg-wall__list">([\s\S]*?)<\/ul>/)![1];
    expect(count(list, /<li class="cbg-pill">/g)).toBe(57);
    expect(list).toContain('<span>Quantity Surveyor · Gulf Build LLC</span>');
    expect(html).not.toContain('aria-hidden="true"><li');
    expect(html).toContain('<p class="cbg-small cbg-fine">Roles at the time of placement.</p>');
  });

  it('drifts in three rows for a big wall, two for a middling one, none for a few', () => {
    expect(placements(s(57))).toContain('<div class="cbg-wall" data-cbg-wall="3">');
    expect(placements(s(12))).toContain('<div class="cbg-wall" data-cbg-wall="2">');
    expect(placements(s(5))).toContain('<div class="cbg-wall"><ul');
  });

  it('escapes its copy', () => {
    const out = placements({ heading: 'H', intro: EVIL, note: EVIL, people: [{ name: EVIL, role: EVIL, company: EVIL }] });
    expect(out).not.toContain(EVIL);
    expect(count(out, new RegExp(ESCAPED, 'g'))).toBe(5);
  });
});

describe('careers', () => {
  it('renders each role as a chip, revealed one after another', () => {
    const html = careers({ heading: 'Where it leads', intro: 'Roles our learners hold.', roles: ['Quantity Surveyor', 'Cost Estimator', EVIL] });
    expect(html).toContain('<ul class="cbg-roles" data-cbg-reveal="stagger"><li>Quantity Surveyor</li><li>Cost Estimator</li>');
    expect(html).toContain(`<li>${ESCAPED}</li>`);
  });
});

describe('a QS-like course', () => {
  // The IOSH file with the QS sections added: the schema takes them, and they render in page order.
  const qs = validateCourse({
    ...structuredClone(loadCourse('iosh-level-3.yaml')),
    certificates: certs, trainers: faculty(13),
    testimonials: { heading: 'In their words', intro: 'Word for word.', quotes: [{ name: 'Rinsha K', text: 'Clear classes.' }] },
    placements: { heading: 'Placed', intro: 'Where they went.', people: Array.from({ length: 30 }, (_, i) => person(i)) },
    careers: { heading: 'Where it leads', intro: 'Roles.', roles: ['Quantity Surveyor'] },
  }) as Course;
  const main = courseMain(qs);

  it('renders the new sections once each, in order, with no em-dash and no h1', () => {
    const at = ['certificates', 'trainers', 'testimonials', 'placements', 'careers'].map((id) => main.indexOf(`id="cbg-${id}"`));
    expect(at.every((i) => i > 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(main).not.toContain(String.fromCharCode(0x2014));
    expect(main).not.toMatch(/<h1[\s>]/);
  });

  it('loads every photo lazily', () => {
    for (const img of main.slice(main.indexOf('id="cbg-certificates"')).match(/<img [^>]*>/g) ?? []) expect(img).toContain('loading="lazy"');
  });
});

describe('placement wall drift', () => {
  it('moves half the crossing distance, never past the row end, never backwards', () => {
    expect(travel(3000, 1200)).toBe(600);
    expect(travel(200, 1200)).toBe(200);
    expect(travel(-50, 1200)).toBe(0);
  });
});
