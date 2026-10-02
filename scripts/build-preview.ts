// Builds dist/preview/*.html: snapshots of the real course.link pages (preview/fixtures) with
// course.link's own scripts removed, its CSS kept, our loader in <head> and our blocks placed
// where Custom Blocks render. scripts/serve.ts serves them at the real course.link paths.
// Local only: the Pages workflow deletes dist/preview before upload.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loaderSnippet } from '../src/loader/snippet';

const ORIGIN = 'https://cbgtraininginstitute.course.link';
const BASE = '/cbg-lms-site/';

const block = (name: string) => {
  const file = `dist/blocks/${name}.html`;
  return existsSync(file) ? `<div id="custom-${name}">${readFileSync(file, 'utf8')}</div>` : '';
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

console.log('preview: dist/preview/home.html, dist/preview/course.html');
