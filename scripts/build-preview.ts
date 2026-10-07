// Builds dist/preview/*.html: snapshots of the real course.link pages (preview/fixtures) with
// course.link's own scripts removed, its CSS kept, our loader in <head> and our blocks placed
// where Custom Blocks render. scripts/serve.ts serves them at the real course.link paths.
// Local only: the Pages workflow deletes dist/preview before upload.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loaderSnippet } from '../src/loader/snippet';
import { PAGES } from '../src/components/html';
import { loadCourse, loadHeroOptions } from '../content/schema';
import { courseTop } from '../templates/course';

const ORIGIN = 'https://cbgtraininginstitute.course.link';
const BASE = '/cbg-lms-site/';

// `local`: asset URLs point at the local build (served at BASE), for a page whose images aren't deployed yet.
// The others keep the Pages URLs, which the e2e specs intercept (e.g. to fail the hero frames).
const block = (name: string, local = false) => {
  const file = `dist/blocks/${name}.html`;
  if (!existsSync(file)) return '';
  const html = readFileSync(file, 'utf8');
  return `<div id="custom-${name}">${local ? html.replaceAll(PAGES, BASE) : html}</div>`;
};

// Insert html just before the opening tag of the element carrying this id.
function beforeId(page: string, id: string, html: string) {
  const at = page.lastIndexOf('<', page.indexOf(` id="${id}"`));
  if (at < 0) throw new Error(`#${id} not found in fixture`);
  return page.slice(0, at) + html + page.slice(at);
}

function mock(fixture: string, place: (page: string) => string) {
  const critical = readFileSync('src/styles/critical.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  let page = readFileSync(`preview/fixtures/${fixture}`, 'utf8')
    .replace(/<script\b[\s\S]*?<\/script>/g, '')
    .replace(/(href|src)="\/(?!\/)/g, `$1="${ORIGIN}/`);
  page = page.replace('</head>', `${loaderSnippet(BASE, critical)}\n</head>`);
  return place(page);
}

mkdirSync('dist/preview', { recursive: true });

// The live home page already has an (empty) Custom Block inside course.link's own wrapper,
// div.custom-section.container.px-primary: ours goes inside it, exactly where the paste lands.
const HOME_SLOT = /(<div id="custom-\d+" class="w-full Custom Block">)(<\/div>)/;

writeFileSync(
  'dist/preview/home.html',
  mock('live-home.html', (p) => {
    if (!HOME_SLOT.test(p)) throw new Error('home Custom Block slot not found in fixture');
    return p.replace(HOME_SLOT, `$1${block('home').replace(/^<div id="custom-home">|<\/div>$/g, '')}$2`)
      .replace('</head>', '<style>#banner-home{display:none}</style></head>');
  }),
);

writeFileSync(
  'dist/preview/course.html',
  mock('live-course.html', (p) =>
    beforeId(beforeId(p, 'course_content', block('iosh-level-3-top')), 'reviews', block('iosh-level-3-main'))),
);

// The QS page as Maasoom set it up (4 Oct 2026), with the native Overview, Learn and FAQ hidden as they
// will be switched off when its blocks are pasted. Main goes where the native FAQ sat, below Course Content.
writeFileSync(
  'dist/preview/qs.html',
  mock('live-course-qs.html', (p) =>
    beforeId(beforeId(p, 'course_content', block('quantity-surveying-top', true)), 'faq', block('quantity-surveying-main', true))
      .replace('</head>', '<style>#overview,#learn,#faq{display:none!important}</style></head>')),
);

// The IOSH page with each hero option in content/hero-options/iosh-level-3.yaml instead of the live hero
// (served at /course/preview-101-<visual>). The top block is rendered here, never written to dist/blocks,
// so nothing of it can be pasted by mistake. Assets point at the local build: a new photo isn't deployed yet.
const { options, waiting } = loadHeroOptions(loadCourse('iosh-level-3.yaml'));
const optionPages = options.map(({ visual, course }) => {
  const top = `<div id="custom-iosh-level-3-top">${courseTop(course).replace(/>\s*\n\s*</g, '><').replaceAll(PAGES, BASE)}</div>`;
  writeFileSync(
    `dist/preview/course-${visual}.html`,
    mock('live-course.html', (p) => beforeId(beforeId(p, 'course_content', top), 'reviews', block('iosh-level-3-main', true))),
  );
  return `dist/preview/course-${visual}.html`;
});

console.log(`preview: dist/preview/home.html, dist/preview/course.html, dist/preview/qs.html${optionPages.map((f) => `, ${f}`).join('')}`);
if (waiting.length) console.log(`  hero options waiting for their photo (not built): ${waiting.join(', ')}`);
