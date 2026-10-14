// Cuts a clip into the frames a scroll-scrubbed hero plays on a canvas (the QS "drawing to building" hero,
// src/motion/scrub.ts), and writes the poster source the image pipeline (scripts/images.ts) turns into the
// hero's <picture>. The general form of scripts/explode-frames.ts (the home hero), with the clip and its
// timing as arguments. Run it again only when the footage changes; the output is committed.
//
//   npm run scrub-frames                                   (the QS clip, brand/assets/qs-hero/build.mp4)
//   npm run scrub-frames -- path/to/clip.mp4 --seconds 3   (another cut of it)
//   then: npm run images                                   (builds the poster's <picture> variants)
//
// Needs ffmpeg and ffprobe on PATH. Options (defaults are the QS hero's):
//   --start S     where the build starts in the clip, seconds (0)
//   --seconds S   how long it runs from there (3: the QS clip is finished by about 2.5 s, then holds)
//   --count N     frames to cut, evenly spaced, first and last included (48; the hero's YAML says the same)
//   --out DIR     frames folder (public/qs-hero: the YAML's scrub.frames names it), written as l/ and s/
//   --poster PNG  poster source, the LAST frame at full size (brand/assets/qs-hero/poster.png)
//   --phone-x F   centre of the phone's square crop, 0..1 of the width (0.5: the building is centred)
//   --sky R,G,B   grade every frame so its sky (the top corners) lands on this colour, the page's background
//                 (the Structural hero: 8,18,38), so the footage melts into the page. Only dark tones move
//                 (see liftDark); the lit building and the gold stay as they are.
//
// Laptops get 16:9 frames (SIZES.l), phones a centred square crop (SIZES.s). Over budget exits 1.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

export const DEFAULTS = {
  clip: 'brand/assets/qs-hero/build.mp4',
  start: 0,
  seconds: 3,
  count: 48,
  out: 'public/qs-hero',
  poster: 'brand/assets/qs-hero/poster.png',
  phoneX: 0.5,
} as const;

// SPEC section 8 budget, as for the home hero: about 2.6 MB (laptop) and 1.6 MB (phone) for all frames.
export const SIZES = {
  l: { w: 1600, h: 900, q: 52, budgetKB: 2600 },
  s: { w: 900, h: 900, q: 44, budgetKB: 1600 },
} as const;

export const frameName = (i: number) => `f${String(i + 1).padStart(2, '0')}.avif`;

// `count` frame numbers spread evenly over `total` (0..total-1), always the first and the last.
export function pick(total: number, count: number): number[] {
  if (total < count) throw new Error(`the clip has ${total} frames in that window, fewer than the ${count} asked for`);
  return Array.from({ length: count }, (_, i) => Math.round((i * (total - 1)) / (count - 1)));
}

// Lifts a dark channel value by `delta` (the sky's distance from the target colour), fading to nothing by
// LIFT_END, so the sky and the shadows shift and everything lit stays put.
export const LIFT_END = 96;
export const liftDark = (v: number, delta: number) =>
  Math.max(0, Math.min(255, Math.round(v + delta * Math.max(0, 1 - v / LIFT_END))));

// Mean RGB of the two top corners (10% wide, rows 2% to 10%): the sky, clear of the building.
async function skyMean(file: string) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0];
  let n = 0;
  const w = Math.round(info.width * 0.1);
  for (let y = Math.round(info.height * 0.02); y < Math.round(info.height * 0.1); y++) {
    for (const x0 of [0, info.width - w]) {
      for (let x = x0; x < x0 + w; x++) {
        const i = (y * info.width + x) * 3;
        sum[0]! += data[i]!; sum[1]! += data[i + 1]!; sum[2]! += data[i + 2]!;
        n++;
      }
    }
  }
  return { mean: sum.map((s) => s / n), data, info };
}

// Grades one frame in place so its sky lands on `target`.
async function gradeSky(file: string, target: number[]) {
  const { mean, data, info } = await skyMean(file);
  const delta = target.map((t, c) => t - mean[c]!);
  for (let i = 0; i < data.length; i += 3) for (let c = 0; c < 3; c++) data[i + c] = liftDark(data[i + c]!, delta[c]!);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toFile(`${file}.graded.png`);
  renameSync(`${file}.graded.png`, file);
}

// The phone's square crop of a w x h frame, centred on fraction x of the width and kept inside the frame.
export function squareCrop(w: number, h: number, x: number) {
  const side = Math.min(w, h);
  const left = Math.round(Math.min(w - side, Math.max(0, x * w - side / 2)));
  return { left, top: Math.round((h - side) / 2), width: side, height: side };
}

const probe = (clip: string) => {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate',
    '-of', 'csv=p=0', clip], { encoding: 'utf8' }).trim().split(',');
  const [num, den] = out[2]!.split('/').map(Number);
  return { width: Number(out[0]), height: Number(out[1]), fps: num! / (den || 1) };
};

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      start: { type: 'string' }, seconds: { type: 'string' }, count: { type: 'string' },
      out: { type: 'string' }, poster: { type: 'string' }, 'phone-x': { type: 'string' }, sky: { type: 'string' },
    },
  });
  const clip = positionals[0] ?? DEFAULTS.clip;
  const start = Number(values.start ?? DEFAULTS.start);
  const seconds = Number(values.seconds ?? DEFAULTS.seconds);
  const count = Number(values.count ?? DEFAULTS.count);
  const out = values.out ?? DEFAULTS.out;
  const poster = values.poster ?? DEFAULTS.poster;
  const phoneX = Number(values['phone-x'] ?? DEFAULTS.phoneX);

  const { width, height, fps } = probe(clip);
  const total = Math.floor(seconds * fps + 1e-6) + 1; // frames in [start, start + seconds], both ends
  const picks = pick(total, count);
  const tmp = mkdtempSync(join(tmpdir(), 'cbg-scrub-'));
  try {
    // Only the picked frames, at full size: one select filter, so no hundreds of temporary PNGs.
    const select = `select='${picks.map((n) => `eq(n\\,${n})`).join('+')}'`;
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(start), '-i', clip, '-t', String(seconds + 1 / fps),
      '-vf', select, '-fps_mode', 'passthrough', join(tmp, 'f%03d.png')], { stdio: 'inherit' });
    const pngs = readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
    if (pngs.length !== count) throw new Error(`expected ${count} frames, ffmpeg wrote ${pngs.length}`);
    if (values.sky) {
      const target = values.sky.split(',').map(Number);
      if (target.length !== 3 || target.some((v) => !(v >= 0 && v <= 255))) throw new Error(`--sky must be R,G,B; got ${values.sky}`);
      for (const f of pngs) await gradeSky(join(tmp, f), target);
      console.log(`sky graded to ${target.join(',')}`);
    }
    mkdirSync(dirname(poster), { recursive: true });
    copyFileSync(join(tmp, pngs[count - 1]!), poster); // the finished building: what reduced motion and no-JS show

    const crop = squareCrop(width, height, phoneX);
    const over: string[] = [];
    for (const [dir, s] of Object.entries(SIZES)) {
      const folder = join(out, dir);
      rmSync(folder, { recursive: true, force: true });
      mkdirSync(folder, { recursive: true });
      let bytes = 0;
      for (let i = 0; i < count; i++) {
        const file = join(folder, frameName(i));
        const img = sharp(join(tmp, pngs[i]!));
        // sharp writes real AVIF (HEIF) files; ffmpeg's .avif output is a bare AV1 stream browsers reject.
        await (dir === 's' ? img.extract(crop) : img)
          .resize(s.w, s.h, { fit: 'cover', kernel: 'lanczos3' })
          .avif({ quality: s.q, effort: 6 })
          .toFile(file);
        bytes += statSync(file).size;
      }
      console.log(`${dir}: ${count} frames at ${s.w}x${s.h}, ${(bytes / 1024).toFixed(0)} KB (budget ${s.budgetKB} KB)`);
      if (bytes > s.budgetKB * 1024) over.push(`${dir} frames are ${(bytes / 1024).toFixed(0)} KB, budget ${s.budgetKB} KB`);
    }
    console.log(`${clip}: ${start}s to ${start + seconds}s at ${fps} fps, frames ${picks[0]}..${picks[count - 1]} of that window`);
    console.log(`poster source: ${poster} (run npm run images next)`);
    if (over.length) {
      console.error(`Over budget:\n  ${over.join('\n  ')}`);
      process.exit(1);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1]?.endsWith('scrub-frames.ts')) main().catch((err) => { console.error(err); process.exit(1); });
