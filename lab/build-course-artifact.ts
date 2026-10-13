// Builds a private Artifact preview of one course page (for checking on a phone before deploying): the mock
// page (dist/preview/<page>.html, so run `npm run build` first) with every asset made relative. The home
// page's version of this is lab/build-lab.ts --artifact --plain. Preview only: never shipped.
//
//   npx tsx lab/build-course-artifact.ts --page sd --route /course/103-structural-design --out lab/out-sd
//
// An Artifact allows no outside stylesheets or scripts, so course.link's own CSS is fetched and inlined,
// its scripts are dropped (the mock has none) and its uploaded images are copied in. The bundle picks the
// page from location.pathname, which in an Artifact is a token URL, so this copy reads the route instead.
// An Artifact version holds at most 511 files: only the laptop frame sets are copied (the bundle's phone
// choice is pinned to them), and only AVIF images.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { PAGES } from '../src/components/html';

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const PAGE = arg('--page') ?? 'sd';
const ROUTE = arg('--route') ?? '/course/103-structural-design';
const OUT = arg('--out') ?? `lab/out-${PAGE}`;
const ORIGIN = 'https://cbgtraininginstitute.course.link';
const SRC = `dist/preview/${PAGE}.html`;
if (!existsSync(SRC)) throw new Error(`no ${SRC}: run \`npm run build\` first`);

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) rmSync(`${OUT}/${f}`, { recursive: true, force: true });
mkdirSync(`${OUT}/site/img`, { recursive: true });
mkdirSync(`${OUT}/site/uploads`);

let page = readFileSync(SRC, 'utf8').replaceAll(PAGES, './site/').replaceAll('/cbg-lms-site/', './site/');

// course.link's CSS, inlined (its relative url()s made absolute, so fonts still try their own host).
for (const m of [...page.matchAll(/<link[^>]+href="(https:\/\/cbgtraininginstitute\.course\.link[^"]+\.css)"[^>]*>/g)]) {
  const css = (await (await fetch(m[1]!)).text()).replace(/url\(\s*(['"]?)\//g, `url($1${ORIGIN}/`);
  page = page.replace(m[0], `<style>${css}</style>`);
}
page = page.replace(/<link[^>]+href="https:\/\/(cbgtraininginstitute|uploads)\.course\.link[^>]*>/g, '');

// Uploaded images (the course card picture, the logo): copied in.
let n = 0;
for (const url of new Set([...page.matchAll(/https:\/\/uploads\.course\.link\/[^"' )]+/g)].map((m) => m[0]))) {
  const ext = url.split('.').pop()!.toLowerCase().replace(/[^a-z]/g, '') || 'png';
  const file = `uploads/u${n++}.${ext}`;
  writeFileSync(`${OUT}/site/${file}`, Buffer.from(await (await fetch(encodeURI(decodeURI(url)))).arrayBuffer()));
  page = page.replaceAll(url, `./site/${file}`);
}

// AVIF only: WebP sources and srcset-only JPEGs dropped (the file limit); the <img src> fallback stays.
page = page.replace(/<source type="image\/webp"[^>]*>/g, '').replace(/(<img[^>]*?) srcset="[^"]*"/g, '$1');

// The build: the scripts and styles, the used images, the frames (laptop sets only), the sky's star data.
for (const f of readdirSync('dist')) if (/^cbg[.-].*\.(js|css)$/.test(f) || f === 'manifest.json') cpSync(`dist/${f}`, `${OUT}/site/${f}`);
for (const d of ['brand', 'sky']) if (existsSync(`dist/${d}`)) cpSync(`dist/${d}`, `${OUT}/site/${d}`, { recursive: true });
for (const m of page.matchAll(/data-cbg-scrub="\.\/site\/([^"/]+)\/"/g)) {
  mkdirSync(`${OUT}/site/${m[1]}`, { recursive: true });
  cpSync(`dist/${m[1]}/l`, `${OUT}/site/${m[1]}/l`, { recursive: true });
}
for (const f of readdirSync('dist/img')) if (page.includes(`img/${f}`)) cpSync(`dist/img/${f}`, `${OUT}/site/img/${f}`);

page = page.replace('location.pathname.replace(', `${JSON.stringify(ROUTE)}.replace(`);
for (const f of readdirSync(`${OUT}/site`)) {
  if (!/^cbg[.-].*\.js$/.test(f)) continue;
  const js = readFileSync(`${OUT}/site/${f}`, 'utf8')
    .replaceAll('location.pathname', JSON.stringify(ROUTE))
    // src/router.ts destructures location from window (minified: {history:r,location:i}=t.window).
    .replace(/\{history:([\w$]+),location:([\w$]+)\}=([\w$]+)\.window/, `{history:$1}=$3.window,$2={pathname:${JSON.stringify(ROUTE)}}`)
    .replace(/\?([`'"])s\1:([`'"])l\2/g, '?"l":"l"');
  writeFileSync(`${OUT}/site/${f}`, js);
}

// The Artifact publish wraps the file in its own skeleton: head and body content only.
page = page.replace(/<!DOCTYPE[^>]*>|<\/?html[^>]*>|<\/?head>|<\/?body[^>]*>/gi, '').replace(/<title>[^<]*<\/title>/i, '');
writeFileSync(`${OUT}/index.html`, `<title>CBG Course Preview</title><meta name="color-scheme" content="dark">${page}`);

const count = (d: string): number => readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? count(`${d}/${e.name}`) : 1), 0);
console.log(`course artifact: ${OUT}/index.html, ${count(OUT)} files`);
