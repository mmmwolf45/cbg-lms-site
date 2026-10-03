// Cuts the home hero footage into the frames the exploding-building hero plays with the scroll
// (SPEC section 5.1.1), and writes the poster source the image pipeline (scripts/images.ts) turns into
// the hero's <picture>. Run it again only when the footage changes; the output is committed.
//
//   npm run explode-frames        (needs ffmpeg on PATH)
//
// Footage: brand/assets/hero-explode/explode-a.mp4, 2560x1440, 24 fps. The explosion runs over its first
// 5.2 s, then holds. A 1440px square around the building (which sits in the middle of the wide frame)
// keeps the files small: the hero shows a square stage anyway.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

export const FRAMES = 48;
const SRC = 'brand/assets/hero-explode/explode-a.mp4';
const SECONDS = 5.2;
const CROP = 'crop=1440:1440:560:0';
// Its own folder: scripts/images.ts rebuilds public/img from scratch on every run.
export const OUT = 'public/hero-explode';
const POSTER = 'brand/assets/hero-explode/poster.png';
// Laptops get 960px frames, phones 640px (SPEC section 8 budget: about 2.6 MB and 1.6 MB in all).
export const SIZES = { l: { px: 960, q: 52, budgetKB: 2600 }, s: { px: 640, q: 50, budgetKB: 1600 } } as const;

export const frameName = (i: number) => `f${String(i + 1).padStart(2, '0')}.avif`;

async function main() {
  const tmp = mkdtempSync(join(tmpdir(), 'cbg-explode-'));
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', SRC, '-t', String(SECONDS),
      '-vf', `fps=${FRAMES}/${SECONDS},${CROP}`, join(tmp, 'f%03d.png')], { stdio: 'inherit' });
    const pngs = readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
    if (pngs.length !== FRAMES) throw new Error(`expected ${FRAMES} frames, ffmpeg wrote ${pngs.length}`);
    copyFileSync(join(tmp, pngs[0]!), POSTER);

    const over: string[] = [];
    for (const [dir, s] of Object.entries(SIZES)) {
      const out = join(OUT, dir);
      rmSync(out, { recursive: true, force: true });
      mkdirSync(out, { recursive: true });
      let bytes = 0;
      for (let i = 0; i < FRAMES; i++) {
        const file = join(out, frameName(i));
        // sharp writes real AVIF (HEIF) files; ffmpeg's .avif output is a bare AV1 stream browsers reject.
        await sharp(join(tmp, pngs[i]!)).resize(s.px, s.px, { kernel: 'lanczos3' }).avif({ quality: s.q, effort: 4 }).toFile(file);
        bytes += statSync(file).size;
      }
      console.log(`${dir}: ${FRAMES} frames at ${s.px}px, ${(bytes / 1024).toFixed(0)} KB`);
      if (bytes > s.budgetKB * 1024) over.push(`${dir} frames are ${(bytes / 1024).toFixed(0)} KB, budget ${s.budgetKB} KB`);
    }
    console.log(`poster source: ${POSTER} (run npm run images next)`);
    if (over.length) {
      console.error(`Over budget:\n  ${over.join('\n  ')}`);
      process.exit(1);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1]?.endsWith('explode-frames.ts')) main().catch((err) => { console.error(err); process.exit(1); });
