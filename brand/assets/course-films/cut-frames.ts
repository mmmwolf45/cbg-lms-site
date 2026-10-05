// Course films: cuts brand/assets/course-films/<scene>/film.mp4 into the square AVIF frames the course story
// scrubs (public/course-films/<scene>/{l,s}/fNN.avif + poster.avif) and records them in films.json.
// Frames are picked at equal steps of visual change (mean absolute grey difference between consecutive video
// frames), so each scroll step moves the picture by about the same amount though the clip eases in and out.
// The backdrop is remapped onto the page navy and the edges blend into EDGE (the course page's html background),
// so no square edge shows against the page (see remap). ORBIT = the measured turn in degrees (written to films.json).
//   FFMPEG=<path to ffmpeg> ORBIT=19.5 npx tsx brand/assets/course-films/cut-frames.ts iosh
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const scene = process.argv[2];
if (!scene) throw new Error('usage: cut-frames.ts <scene>');
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const SRC = `brand/assets/course-films/${scene}/film.mp4`;
const OUT = `public/course-films/${scene}`;
const MANIFEST = 'public/course-films/films.json';
const N = 40;
const SIZES = { l: { w: 1000, q: 58 }, s: { w: 560, q: 54 } } as const;
const EDGE = [8, 18, 38] as const; // #081226
const A = 256; // analysis size

const grey = (f: string) => sharp(f).resize(A, A, { fit: 'fill' }).greyscale().raw().toBuffer();
const diff = (a: Buffer, b: Buffer) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i]! - b[i]!); return s / a.length; };

// Backdrop remap, then edge blend. The generated backdrop is a saturated blue (about #051640 at its brightest,
// #000213 at the edges), lighter and bluer than the page; blue-dominant dark pixels (blue well above red) are
// mapped onto the page's own navy ramp, EDGE .. GLOW, by their blue level. Objects (orange, steel, gold, the
// neutral dark base) have no blue excess and stay as they are. Then the edges blend into EDGE through a
// rounded-square ramp (superellipse, p = 8: untouched inside half-size 0.44, EDGE at the frame edge).
const GLOW = [13, 28, 56] as const;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
async function remap(file: string, w: number) {
  const px = await sharp(file).removeAlpha().raw().toBuffer();
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3, r = px[i]!, g = px[i + 1]!, b = px[i + 2]!;
    const bg = smooth(8, 24, b - Math.max(r, g * 0.55)) * (1 - smooth(70, 110, b));
    const t = smooth(18, 66, b);
    const u = (x + 0.5) / w - 0.5, v = (y + 0.5) / w - 0.5;
    const e = smooth(0.44, 0.5, Math.pow(u ** 8 + v ** 8, 0.125));
    for (let c = 0; c < 3; c++) {
      const target = EDGE[c]! + (GLOW[c]! - EDGE[c]!) * t;
      const m = px[i + c]! + (target - px[i + c]!) * bg;
      px[i + c] = Math.round(m + (EDGE[c]! - m) * e);
    }
  }
  return sharp(px, { raw: { width: w, height: w, channels: 3 } });
}

const tmp = mkdtempSync(join(tmpdir(), `${scene}-film-`));
try {
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', SRC, '-vf', `crop='min(iw,ih)':'min(iw,ih)',scale=${SIZES.l.w}:${SIZES.l.w}:flags=lanczos`, join(tmp, 'v%04d.png')], { stdio: 'inherit' });
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
  if (process.env.REVERSE === '1') pick.reverse();
  console.log(`picked: ${pick.join(' ')}`);

  const sizes: Record<string, { w: number; bytes: number }> = {};
  for (const [dir, s] of Object.entries(SIZES)) {
    const out = join(OUT, dir);
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    let bytes = 0;
    for (let k = 0; k < N; k++) {
      const file = join(out, `f${String(k + 1).padStart(2, '0')}.avif`);
      const src = join(tmp, all[pick[k]!]!);
      const sized = join(tmp, `sized-${dir}.png`);
      await sharp(src).resize(s.w, s.w, { kernel: 'lanczos3' }).png().toFile(sized);
      await (await remap(sized, s.w)).avif({ quality: s.q, effort: 6 }).toFile(file);
      bytes += statSync(file).size;
    }
    sizes[dir] = { w: s.w, bytes };
    console.log(`${dir}: ${N} frames at ${s.w}px, ${bytes} bytes (${(bytes / 1024).toFixed(0)} KB)`);
  }
  // Poster = the middle frame (shown before frames load and under reduced motion).
  const mid = `f${String(N / 2).padStart(2, '0')}.avif`;
  copyFileSync(join(OUT, 'l', mid), join(OUT, 'poster.avif'));
  console.log(`poster: ${mid}, ${statSync(join(OUT, 'poster.avif')).size} bytes`);

  const films = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
  films[scene] = {
    frames: N,
    sizes,
    poster: `course-films/${scene}/poster.avif`,
    posterFrame: N / 2,
    edge: '#081226',
    angle: { orbit: 'right', guideDeg: 20, measuredDeg: process.env.ORBIT ? Number(process.env.ORBIT) : null, reversedClip: process.env.REVERSE === '1' },
  };
  writeFileSync(MANIFEST, JSON.stringify(films, null, 2) + '\n');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
