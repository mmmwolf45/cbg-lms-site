// Renders templates + content into dist/blocks/*.html (paste-ready Custom Blocks).
// `tsx scripts/build-blocks.ts --dummy` writes only the example course, content/courses/_dummy.yaml,
// as dist/blocks/_dummy-top.html and _dummy-main.html (to check the template; never pasted).
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadCourse, loadCourses, loadHome } from '../content/schema';
import { home } from '../templates/home';
import { courseMain, courseTop } from '../templates/course';

// Drop the templates' line breaks between tags: blocks are pasted, not read.
const min = (html: string) => html.replace(/>\s*\n\s*</g, '><');

const write = (name: string, html: string) => {
  const out = min(html);
  writeFileSync(`dist/blocks/${name}.html`, out);
  console.log(`blocks: dist/blocks/${name}.html ${Buffer.byteLength(out)} bytes`);
};

mkdirSync('dist/blocks', { recursive: true });
const dummy = process.argv.includes('--dummy');
const courses = dummy ? [loadCourse('_dummy.yaml')] : loadCourses();
if (!dummy) write('home', home(loadHome(), courses));
// Two blocks per course: top (hero, above Course Content) and main (everything else, below it).
for (const c of courses) {
  write(`${c.slug}-top`, courseTop(c));
  write(`${c.slug}-main`, courseMain(c));
}
