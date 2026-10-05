// Lab prototype (band D, "Film scrub"): cuts crane-up.mp4 into the frames lab/fx/band-scrub.js scrubs.
// Same approach as scripts/explode-frames.ts (ffmpeg for stills, sharp for real AVIF files), plus one
// step: the clip's camera eases in and out (fast in the middle), so frames are picked at equal steps of
// camera travel, not of time. Each frame then moves the picture by the same amount, and the scroll
// scrub reads as one constant, slow rise. Travel = the vertical shift between consecutive video frames,
// found by a small brute-force match at 320px.
//   FFMPEG=<path to ffmpeg> npx tsx brand/assets/band-scrub/cut-frames.ts
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const SRC = 'brand/assets/band-scrub/crane-up.mp4';
const OUT = 'lab/assets/band-scrub';
const N = 48;
const SIZES = { l: { w: 1280, q: 60 }, s: { w: 768, q: 56 } } as const;
const AW = 320, AH = 180, MAXDY = 24; // analysis size and the largest shift searched (px at 320)

const gray = async (f: string) => sharp(f).resize(AW, AH, { fit: 'fill' }).greyscale().raw().toBuffer();

// Vertical shift d (px, content moves down as the camera rises) minimising the mean absolute difference
// b(y) ~ a(y - d), refined to sub-pixel with a parabola through the best three.
function shift(a: Buffer, b: Buffer) {
  const err = (d: number) => {
    let s = 0;
    for (let y = d; y < AH; y++) for (let x = 0; x < AW; x++) s += Math.abs(b[y * AW + x]! - a[(y - d) * AW + x]!);
    return s / ((AH - d) * AW);
  };
  const e = Array.from({ length: MAXDY + 1 }, (_, d) => err(d));
  const k = e.indexOf(Math.min(...e));
  if (k === 0 || k === MAXDY) return k;
  const den = e[k - 1]! - 2 * e[k]! + e[k + 1]!;
  return den > 0 ? k + (0.5 * (e[k - 1]! - e[k + 1]!)) / den : k;
}

const tmp = mkdtempSync(join(tmpdir(), 'band-scrub-'));
try {
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', SRC, '-vf', `scale=${SIZES.l.w}:-1:flags=lanczos`, join(tmp, 'v%04d.png')], { stdio: 'inherit' });
  const all = readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
  const g = await Promise.all(all.map((f) => gray(join(tmp, f))));
  const travel = [0];
  for (let i = 1; i < g.length; i++) travel.push(travel[i - 1]! + Math.max(0, shift(g[i - 1]!, g[i]!)));
  const total = travel.at(-1)!;
  console.log(`${all.length} video frames, camera travel ${total.toFixed(1)}px at ${AH}px tall`);

  // Equal steps of travel; between two video frames take the nearer one.
  const pick = Array.from({ length: N }, (_, k) => {
    const t = (k / (N - 1)) * total;
    let i = travel.findIndex((v) => v >= t);
    if (i < 0) i = travel.length - 1;
    if (i > 0 && t - travel[i - 1]! < travel[i]! - t) i -= 1;
    return i;
  });
  console.log(`picked: ${pick.join(' ')}`);
  // Where each picked frame sits along the travel, as a share of the frame height: band-scrub.js shifts
  // the two frames it blends by these amounts so they line up (no double image between frames).
  console.log(`TRAVEL = [${pick.map((i) => +(travel[i]! / AH).toFixed(4)).join(', ')}]`);

  for (const [dir, s] of Object.entries(SIZES)) {
    const out = join(OUT, dir);
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    let bytes = 0;
    for (let k = 0; k < N; k++) {
      const file = join(out, `f${String(k + 1).padStart(2, '0')}.avif`);
      await sharp(join(tmp, all[pick[k]!]!)).resize(s.w, null, { kernel: 'lanczos3' }).avif({ quality: s.q, effort: 6 }).toFile(file);
      bytes += statSync(file).size;
    }
    console.log(`${dir}: ${N} frames at ${s.w}px, ${(bytes / 1024).toFixed(0)} KB`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
