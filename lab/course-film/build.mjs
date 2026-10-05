// Copies the review page and the IOSH film frames into lab/course-film/out/ (relative paths only),
// ready to serve or publish as an Artifact.   node lab/course-film/build.mjs
import { cpSync, rmSync } from 'node:fs';

const OUT = 'lab/course-film/out';
rmSync(OUT, { recursive: true, force: true });
cpSync('public/course-films/iosh', `${OUT}/frames`, { recursive: true });
for (const f of ['index.html', 'film.js']) cpSync(`lab/course-film/${f}`, `${OUT}/${f}`);
console.log(`built ${OUT}`);
