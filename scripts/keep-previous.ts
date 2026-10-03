// Run in the Pages workflow after `npm run build`: copies the hashed JS and CSS of the last KEEP builds
// from the live site into dist/, and writes dist/assets.json listing what each build shipped.
//
// Why: the loader caches manifest.json for up to 10 minutes (its ?t= bucket plus Pages' max-age=600).
// A browser that read the manifest just before a deploy keeps asking for the old file names, and a
// deploy that dropped them answered 404, so the loader's fail-safe showed stock course.link with our
// block unstyled (seen on a laptop, 3 Oct 2026). Old files stay a few deploys; they are a few KB.
import { mkdirSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KEEP = 2; // previous builds kept beside the current one
const BASE = process.env.CBG_BASE ?? 'https://mmmwolf45.github.io/cbg-lms-site/';
const DIST = 'dist';

export const HASHED = /^cbg[.-][\w.-]+\.(js|css)$/;

// The hashed files a build shipped: entry and stylesheet from the manifest, the lazy page chunks
// named inside the entry.
export function buildFiles(manifest: { js: string; css: string }, entrySource: string): string[] {
  const chunks = entrySource.match(/cbg-[a-z]+\.[\w-]+\.js/g) ?? [];
  return [...new Set([manifest.js, manifest.css, ...chunks])].sort();
}

// The new history: this build first, then up to KEEP earlier ones (never repeating this build).
export function nextHistory(current: string[], previous: string[][]): string[][] {
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((f, i) => f === b[i]);
  return [current, ...previous.filter((b) => !same(b, current))].slice(0, KEEP + 1);
}

async function text(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    return res.ok ? await res.text() : undefined;
  } catch {
    return undefined;
  }
}

async function main() {
  const current = readdirSync(DIST).filter((f) => HASHED.test(f)).sort();
  let previous: string[][] = [];
  const index = await text(`${BASE}assets.json`);
  if (index) {
    previous = (JSON.parse(index) as { builds: string[][] }).builds;
  } else {
    // First run: work out what the live build shipped from its manifest.
    const manifest = await text(`${BASE}manifest.json`);
    if (manifest) {
      const m = JSON.parse(manifest) as { js: string; css: string };
      const entry = await text(BASE + m.js);
      if (entry) previous = [buildFiles(m, entry)];
    }
  }
  const history = nextHistory(current, previous);
  let copied = 0;
  for (const file of new Set(history.slice(1).flat())) {
    if (!HASHED.test(file) || existsSync(join(DIST, file))) continue;
    const body = await fetch(BASE + file, { cache: 'no-store' }).catch(() => undefined);
    if (!body?.ok) {
      console.warn(`keep-previous: ${file} is no longer on the live site, skipped`);
      continue;
    }
    mkdirSync(DIST, { recursive: true });
    writeFileSync(join(DIST, file), Buffer.from(await body.arrayBuffer()));
    copied++;
  }
  writeFileSync(join(DIST, 'assets.json'), JSON.stringify({ builds: history }, null, 2));
  console.log(`keep-previous: ${current.length} current files, ${copied} kept from ${history.length - 1} earlier build(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    // Never block a deploy: the new build works on its own; only stale-manifest visitors would miss out.
    console.warn('keep-previous failed:', err);
  });
}
