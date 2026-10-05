// Cuts the home band's orbit footage into the frames src/motion/site-orbit.ts plays with the scroll
// (SPEC section 5.1.2), and writes the poster source scripts/images.ts turns into the band's <picture>.
// Run it again only when the footage changes; the output is committed.
//
//   npx tsx scripts/orbit-frames.ts        (needs ffmpeg on PATH, or FFMPEG=<path>)
//
// Footage: brand/assets/site-orbit/orbit.mp4 (MiniMax H3, 2K, 6.6 s): the camera swings half way round a
// night construction site. The band plays its first third, about 60 degrees, from the poster's corner view
// to nearly face-on (Maasoom, 6 Oct 2026: the half turn was too much; 64 frames over 180 degrees became
// these 22 over 60, the same frames, so the turn per frame is unchanged). The model eases the move in and out (and holds still for the last second), so
// frames are picked at equal steps of camera travel, not of time (as brand/assets/band-scrub/cut-frames.ts
// did for the crane-up film): every frame then turns the site by about the same angle and the scroll
// reads as one slow, even turn. Travel = how far the picture moves between consecutive video frames: the
// mean block-matching motion over the textured parts of the frame, at 320px. (A single sideways shift
// doesn't work here: the horizon is dark and flat, and an orbit moves near and far things differently.)
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

export const FRAMES = 22;
const TURN = 1 / 3; // the share of the clip's camera travel the band plays
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const SRC = 'brand/assets/site-orbit/orbit.mp4';
const POSTER = 'brand/assets/site-orbit/poster.png';
// Its own folder: scripts/images.ts rebuilds public/img from scratch on every run.
export const OUT = 'public/site-orbit';
// Laptops get 1600px frames, phones 900px (SPEC section 8 budget, approved exception like the hero's).
export const SIZES = { l: { w: 1600, q: 42, budgetKB: 1050 }, s: { w: 900, q: 42, budgetKB: 450 } } as const;
export const frameName = (i: number) => `f${String(i + 1).padStart(2, '0')}.avif`;

const AW = 320, AH = 180, BLOCK = 16, R = 8; // analysis size, block size, largest motion searched (px)
const NOISE = 0.02; // the measured motion of a still camera (video noise), taken off every step

const gray = (f: string) => sharp(f).resize(AW, AH, { fit: 'fill' }).greyscale().raw().toBuffer();

// Mean motion (px) from a to b: each textured 16px block is matched in b within +-8px (sum of absolute
// differences), refined to sub-pixel with a parabola per axis, and weighted by its contrast.
function motion(a: Buffer, b: Buffer) {
  const at = (img: Buffer, x: number, y: number) => img[y * AW + x]!;
  let sum = 0, wsum = 0;
  for (let by = R; by + BLOCK + R <= AH; by += BLOCK) for (let bx = R; bx + BLOCK + R <= AW; bx += BLOCK) {
    let m = 0, v = 0;
    for (let y = 0; y < BLOCK; y++) for (let x = 0; x < BLOCK; x++) m += at(a, bx + x, by + y);
    m /= BLOCK * BLOCK;
    for (let y = 0; y < BLOCK; y++) for (let x = 0; x < BLOCK; x++) v += (at(a, bx + x, by + y) - m) ** 2;
    v /= BLOCK * BLOCK;
    if (v < 60) continue; // flat sky or sand: nothing to match
    const sad = (dx: number, dy: number) => {
      let s = 0;
      for (let y = 0; y < BLOCK; y++) for (let x = 0; x < BLOCK; x++) s += Math.abs(at(b, bx + x + dx, by + y + dy) - at(a, bx + x, by + y));
      return s;
    };
    let best = Infinity, bx0 = 0, by0 = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const s = sad(dx, dy);
      if (s < best) [best, bx0, by0] = [s, dx, dy];
    }
    const sub = (l: number, r: number) => { const den = l - 2 * best + r; return den > 0 ? (0.5 * (l - r)) / den : 0; };
    const fx = bx0 + (Math.abs(bx0) < R ? sub(sad(bx0 - 1, by0), sad(bx0 + 1, by0)) : 0);
    const fy = by0 + (Math.abs(by0) < R ? sub(sad(bx0, by0 - 1), sad(bx0, by0 + 1)) : 0);
    sum += Math.hypot(fx, fy) * Math.sqrt(v);
    wsum += Math.sqrt(v);
  }
  return wsum ? sum / wsum : 0;
}

async function main() {
  const tmp = mkdtempSync(join(tmpdir(), 'cbg-orbit-'));
  try {
    execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', SRC, join(tmp, 'v%04d.png')], { stdio: 'inherit' });
    const all = readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
    const g = await Promise.all(all.map((f) => gray(join(tmp, f))));
    const travel = [0];
    for (let i = 1; i < g.length; i++) travel.push(travel[i - 1]! + Math.max(0, motion(g[i - 1]!, g[i]!) - NOISE));
    const total = travel.at(-1)!;
    console.log(`${all.length} video frames, travel ${total.toFixed(1)}px at ${AW}px wide`);
    console.log(`per-frame travel: ${travel.slice(1).map((t, i) => (t - travel[i]!).toFixed(2)).join(' ')}`);

    // Equal steps of travel over the first TURN of it; between two video frames take the nearer one.
    const pick = Array.from({ length: FRAMES }, (_, k) => {
      const t = (k / (FRAMES - 1)) * total * TURN;
      let i = travel.findIndex((v) => v >= t);
      if (i < 0) i = travel.length - 1;
      if (i > 0 && t - travel[i - 1]! < travel[i]! - t) i -= 1;
      return i;
    });
    console.log(`picked: ${pick.join(' ')}`);
    copyFileSync(join(tmp, all[pick[0]!]!), POSTER);

    const over: string[] = [];
    for (const [dir, s] of Object.entries(SIZES)) {
      const out = join(OUT, dir);
      rmSync(out, { recursive: true, force: true });
      mkdirSync(out, { recursive: true });
      let bytes = 0;
      for (let k = 0; k < FRAMES; k++) {
        const file = join(out, frameName(k));
        // sharp writes real AVIF (HEIF) files; ffmpeg's .avif output is a bare AV1 stream browsers reject.
        await sharp(join(tmp, all[pick[k]!]!)).resize(s.w, null, { kernel: 'lanczos3' }).avif({ quality: s.q, effort: 6 }).toFile(file);
        bytes += statSync(file).size;
      }
      console.log(`${dir}: ${FRAMES} frames at ${s.w}px, ${(bytes / 1024).toFixed(0)} KB`);
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

if (process.argv[1]?.endsWith('orbit-frames.ts')) main().catch((err) => { console.error(err); process.exit(1); });
