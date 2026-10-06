// Builds the night-sky prototype ("lab"): the real home preview page (dist/preview/home.html, so run
// `npm run build` first) with every asset made relative, plus the lab switcher and the fx modules.
// Prototype only: never shipped, not part of the size budget. See lab/README.md.
//
//   npx tsx lab/build-lab.ts                    -> lab/out
//   npx tsx lab/build-lab.ts --out lab/out-sky  -> another folder (one per agent, so builds don't collide)
//   npx tsx lab/build-lab.ts --artifact         -> also strips course.link's own CSS/JS links (blocked in an Artifact)
//   npx tsx lab/build-lab.ts --plain            -> the real page only (no switcher, no fx): a preview of the build
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { PAGES } from '../src/components/html';

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const OUT = arg('--out') ?? 'lab/out';
const ARTIFACT = process.argv.includes('--artifact');
const PLAIN = process.argv.includes('--plain');

if (!existsSync('dist/preview/home.html')) throw new Error('run `npm run build` first');
// Empty OUT rather than delete it (Windows refuses to remove a folder a shell is sitting in).
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) rmSync(`${OUT}/${f}`, { recursive: true, force: true });
mkdirSync(`${OUT}/site`);

// The site build, at ./site/ (only what the home page uses).
for (const f of readdirSync('dist')) {
  if (/^cbg[.-].*\.(js|css)$/.test(f) || f === 'manifest.json') cpSync(`dist/${f}`, `${OUT}/site/${f}`);
}
for (const d of ['brand', 'hero-explode', 'sky', 'band-desk']) if (existsSync(`dist/${d}`)) cpSync(`dist/${d}`, `${OUT}/site/${d}`, { recursive: true });

// The lab itself.
if (!PLAIN) {
  for (const d of ['fx', 'vendor', 'assets']) if (existsSync(`lab/${d}`)) cpSync(`lab/${d}`, `${OUT}/${d}`, { recursive: true });
  cpSync('lab/lab.js', `${OUT}/lab.js`);
  cpSync('lab/lab.css', `${OUT}/lab.css`);
}

const css = existsSync('lab/fx') ? readdirSync('lab/fx').filter((f) => f.endsWith('.css')).map((f) => f.slice(0, -4)) : [];

let page = readFileSync('dist/preview/home.html', 'utf8')
  .replaceAll(PAGES, './site/')
  .replaceAll('"/cbg-lms-site/"', '"./site/"');

if (ARTIFACT) {
  page = page
    .replace(/<link[^>]+href="https:\/\/cbgtraininginstitute\.course\.link[^>]*>/g, '')
    .replace(/<link[^>]+href="https:\/\/uploads\.course\.link[^>]*>/g, '')
    .replace(/src="https:\/\/uploads\.course\.link[^"]*"/g, 'src="./site/brand/cbg-mark-160.png"')
    .replace('</head>', `<link rel="stylesheet" href="./lab-shim.css"></head>`);
  cpSync('lab/lab-shim.css', `${OUT}/lab-shim.css`);
}

// dist/img holds every page's images: copy only the home page's. In an Artifact (a file-count limit),
// AVIF only plus the <img src> fallbacks: WebP sources and srcset-only JPEGs are dropped.
if (ARTIFACT) page = page.replace(/<source type="image\/webp"[^>]*>/g, '').replace(/(<img[^>]*?) srcset="[^"]*"/g, '$1');
mkdirSync(`${OUT}/site/img`);
for (const f of readdirSync('dist/img')) if (page.includes(`img/${f}`)) cpSync(`dist/img/${f}`, `${OUT}/site/img/${f}`);

// The loader and the bundle pick the home route from location.pathname === "/". The lab's URL is never
// "/" in an Artifact (a token URL), so both read a fixed "/" instead: in the page's inline loader and in
// this copy of the bundle. No history rewrite, so relative URLs and reloads keep working.
const boot = `<script>window.__labHref=location.href;window.__labCss=${JSON.stringify(css)};</script>`;
// --debug: a visible status line (boot stage and any error), for checking a build inside the Artifact viewer.
const DEBUG = process.argv.includes('--debug') ? `<script>(function(){var d=document.createElement('pre');`
  + `d.style.cssText='position:fixed;top:0;right:0;z-index:2147483647;margin:0;padding:6px 8px;max-width:60vw;white-space:pre-wrap;font:12px monospace;background:#ff0;color:#000';`
  + `function log(m){d.textContent+=m+String.fromCharCode(10)}window.__labLog=log;log('boot '+location.pathname+' '+document.readyState);`
  + `addEventListener('error',function(e){log('ERR '+(e.message||e.target&&(e.target.src||e.target.href)))},true);`
  + `addEventListener('unhandledrejection',function(e){log('REJ '+e.reason)});`
  + `var t=setInterval(function(){log('t '+document.documentElement.className+' cbg='+window.__cbg+' lab='+!!window.__lab)},1500);setTimeout(function(){clearInterval(t)},9000);`
  + `(document.body||document.documentElement).appendChild(d)})();</script>` : '';
page = page.replace('location.pathname.replace(', '"/".replace(');
for (const f of readdirSync(`${OUT}/site`)) {
  if (!/^cbg[.-].*\.js$/.test(f)) continue;
  let js = readFileSync(`${OUT}/site/${f}`, 'utf8').replaceAll('location.pathname', '"/"');
  // An Artifact version holds at most 511 files: in artifact mode every film plays its large frame set
  // (the small "s" folders are not copied), so the bundle's phone choice ?`s`:`l` becomes ?`l`:`l`
  // (the minifier may use any quote style).
  if (ARTIFACT) js = js.replace(/\?([`'"])s\1:([`'"])l\2/g, '?"l":"l"');
  writeFileSync(`${OUT}/site/${f}`, js);
}
if (ARTIFACT) {
  const prune = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      if (e.name === 's') rmSync(`${dir}/${e.name}`, { recursive: true, force: true });
      else prune(`${dir}/${e.name}`);
    }
  };
  prune(`${OUT}/site`);
}
page = page.replace(/<head>/, `<head>${DEBUG}${boot}`);

if (!PLAIN) page = page.replace('</head>', '<link rel="stylesheet" href="./lab.css"></head>').replace(
  '</body>',
  // No vendored GSAP here: a window.gsap present before the bundle starts hijacks the bundle's own
  // ScrollTrigger (the courses pin breaks). lab.js loads it after the bundle is up.
  '<script type="module" src="./lab.js"></script></body>',
);

// The Artifact publish wraps the file in its own document skeleton: hand it the head and body content only,
// with a name for the gallery and a dark color-scheme.
if (ARTIFACT) {
  page = page.replace(/<!DOCTYPE[^>]*>|<\/?html[^>]*>|<\/?head>|<\/?body[^>]*>/gi, '')
    .replace(/<title>[^<]*<\/title>/i, '');
  page = `<title>${PLAIN ? 'CBG Home Preview' : 'CBG Night Sky Lab'}</title><meta name="color-scheme" content="dark">${page}`;
}

writeFileSync(`${OUT}/index.html`, page);
console.log(`lab: ${OUT}/index.html (${css.length} fx stylesheets${ARTIFACT ? ', artifact mode' : ''})`);
