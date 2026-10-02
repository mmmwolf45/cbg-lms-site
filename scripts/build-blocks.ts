// Renders templates + content into dist/blocks/*.html (paste-ready Custom Blocks).
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadCourses, loadHome } from '../content/schema';
import { home } from '../templates/home';

// Drop the templates' line breaks between tags: blocks are pasted, not read.
const min = (html: string) => html.replace(/>\s*\n\s*</g, '><');

mkdirSync('dist/blocks', { recursive: true });
const out = min(home(loadHome(), loadCourses()));
writeFileSync('dist/blocks/home.html', out);
console.log(`blocks: dist/blocks/home.html ${Buffer.byteLength(out)} bytes`);
