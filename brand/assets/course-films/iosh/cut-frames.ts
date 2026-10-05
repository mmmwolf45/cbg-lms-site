// IOSH course film (pilot): cuts film.mp4 into the frames lab/course-film scrubs.
// Same approach as brand/assets/band-scrub/cut-frames.ts (ffmpeg for stills, sharp for AVIF), but the
// camera here pushes in and arcs instead of rising, so "motion" is measured as the mean absolute
// difference between consecutive video frames (grey, 256 px). Frames are picked at equal steps of that
// cumulative change, so each scrub step changes the picture by about the same amount even though the
// clip eases in and out.
//   FFMPEG=<path to ffmpeg> npx tsx brand/assets/course-films/iosh/cut-frames.ts
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const SRC = 'brand/assets/course-films/iosh/film.mp4';
const OUT = 'public/course-films/iosh';
const N = 40;
const SIZES = { l: { w: 1000, q: 58 }, s: { w: 560, q: 54 } } as const;
const A = 256; // analysis size

const grey = (f: string) => sharp(f).resize(A, A, { fit: 'fill' }).greyscale().raw().toBuffer();
const diff = (a: Buffer, b: Buffer) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i]! - b[i]!); return s / a.length; };

const tmp = mkdtempSync(join(tmpdir(), 'iosh-film-'));
try {
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', SRC, '-vf', `scale=${SIZES.l.w}:-1:flags=lanczos`, join(tmp, 'v%04d.png')], { stdio: 'inherit' });
  const all = readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
  const g = await Promise.all(all.map((f) => grey(join(tmp, f))));
  const change = [0];
  for (let i = 1; i < g.length; i++) change.push(change[i - 1]! + diff(g[i - 1]!, g[i]!));
  const total = change.at(-1)!;
  console.log(`${all.length} video frames, cumulative change ${total.toFixed(1)}`);

  const pick = Array.from({ length: N }, (_, k) => {
    const t = (k / (N - 1)) * total;
    let i = change.findIndex((v) => v >= t);
    if (i < 0) i = change.length - 1;
    if (i > 0 && t - change[i - 1]! < change[i]! - t) i -= 1;
    return i;
  });
  console.log(`picked: ${pick.join(' ')}`);

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
    console.log(`${dir}: ${N} frames at ${s.w}px, ${bytes} bytes (${(bytes / 1024).toFixed(0)} KB)`);
  }
  // Poster = the first frame (shown before frames load and under reduced motion).
  copyFileSync(join(OUT, 'l', 'f01.avif'), join(OUT, 'poster.avif'));
  console.log(`poster: ${statSync(join(OUT, 'poster.avif')).size} bytes`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
