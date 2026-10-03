// Turns brand/assets photos and trainer headshots into AVIF/WebP/JPEG at the widths the
// templates need, writes them to public/img/ and lists them in src/images.json.
// Exits non-zero if a required image is missing or an AVIF is over its budget (SPEC section 8).
// Optional photos (the home course cards and band, still being made) are skipped while missing: the
// templates show a placeholder card image, and no band.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

type Crop = { left: number; top: number; width: number; height: number };
type Quality = { avif: number; webp: number; jpg: number; chroma?: '4:4:4'; bits?: 10 };
type Job = {
  name: string; src: string; widths: number[]; q: Quality;
  crop?: Crop; square?: boolean; budgetKB: number; optional?: boolean;
};
type Variant = { w: number; file: string; bytes: number };
type Entry = { width: number; height: number; crop?: Crop; variants: Record<Fmt, Variant[]> };
type Fmt = 'avif' | 'webp' | 'jpg';

const PHOTOS = 'brand/assets/photos';
const TRAINERS = 'brand/assets/trainers';
const OUT = 'public/img';

const photo: Quality = { avif: 50, webp: 72, jpg: 74 };
// Smooth sky gradient: AVIF drops the source's fine grain, which leaves 1-level blocks in 8 bit.
// Full chroma plus 10 bit keeps the sky smooth (and is smaller than raising quality).
const gradient: Quality = { avif: 62, webp: 80, jpg: 80, chroma: '4:4:4', bits: 10 };
const face: Quality = { avif: 55, webp: 78, jpg: 78 };

// Headshots are near square already; this one is framed wider than the others, so tighten it
// to put the face at the same size and eye line.
const FACE: Record<string, Crop> = { 'ali-orkkatteri.jpg': { left: 64, top: 0, width: 290, height: 290 } };

const trainers = readdirSync(TRAINERS).filter((f) => !f.startsWith('.') && f !== 'desktop.ini').sort();
const odd = trainers.filter((f) => !f.endsWith('.jpg'));
if (odd.length || !trainers.length) throw new Error(`expected only .jpg trainer photos in ${TRAINERS}, found: ${odd.join(', ') || 'none'}`);

const jobs: Job[] = [
  { name: 'hero-structure', src: `${PHOTOS}/hero-structure.png`, widths: [1600, 1024], q: photo, budgetKB: 250 },
  { name: 'hero-structure-phone', src: `${PHOTOS}/hero-structure.png`, widths: [900, 600], q: photo, budgetKB: 120,
    crop: { left: 171, top: 0, width: 1365, height: 1024 } },
  { name: 'hazard-worksite', src: `${PHOTOS}/hazard-worksite.png`, widths: [1536, 1024, 768], q: photo, budgetKB: 250 },
  { name: 'closing-plate', src: `${PHOTOS}/closing-plate.png`, widths: [1536, 800], q: gradient, budgetKB: 150 },
  // Home course cards (3:2 sources, shown cropped to 4:3) and the home band. Optional until supplied.
  ...['course-iosh', 'course-qs', 'course-mep', 'course-structural', 'course-bim', 'course-interior'].map((name) => ({
    name, src: `${PHOTOS}/${name}.png`, widths: [800, 480], q: photo, budgetKB: 60, optional: true,
  })),
  // Full-bleed band: a large laptop screen needs about 2560 device pixels across (1707 CSS px at 1.5x).
  // The source is a 2x AI upscale (3 Oct 2026); phones still pick 1536 or 1024 from the srcset.
  { name: 'band-classroom', src: `${PHOTOS}/band-classroom.png`, widths: [2560, 2048, 1536, 1024], q: photo, budgetKB: 260, optional: true },
  ...trainers.map((f) => ({
    name: `trainer-${f.replace('.jpg', '')}`, src: `${TRAINERS}/${f}`, widths: [224, 112], q: face, budgetKB: 20, square: true, crop: FACE[f],
  })),
];

function encode(img: ReturnType<typeof sharp>, fmt: Fmt, q: Quality) {
  if (fmt === 'avif') return img.avif({ quality: q.avif, effort: 6, chromaSubsampling: q.chroma ?? '4:2:0', bitdepth: q.bits ?? 8 });
  if (fmt === 'webp') return img.webp({ quality: q.webp, effort: 6, smartSubsample: true });
  return img.jpeg({ quality: q.jpg, mozjpeg: true });
}

async function build(job: Job): Promise<Entry> {
  const meta = await sharp(job.src).metadata();
  const full = job.crop ?? { left: 0, top: 0, width: meta.width, height: meta.height };
  const side = Math.min(full.width, full.height);
  const maxW = job.square ? side : full.width;
  // Never upscale: a width above the source is capped at the source width.
  const widths = [...new Set(job.widths.map((w) => Math.min(w, maxW)))].sort((a, b) => b - a);
  const variants: Record<Fmt, Variant[]> = { avif: [], webp: [], jpg: [] };

  for (const w of widths) {
    const h = job.square ? w : Math.round((w * full.height) / full.width);
    for (const fmt of ['avif', 'webp', 'jpg'] as const) {
      let img = sharp(job.src);
      if (job.crop) img = img.extract(job.crop);
      img = img.resize(w, h, { fit: 'cover', position: 'centre' });
      const file = `img/${job.name}-${w}.${fmt}`;
      const { size } = await encode(img, fmt, job.q).toFile(`public/${file}`);
      variants[fmt].push({ w, file, bytes: size });
    }
  }
  const width = widths[0];
  const height = job.square ? width : Math.round((width * full.height) / full.width);
  // The manifest records the crop for art-directed variants only (the phone hero), not face framing.
  return { width, height, ...(job.crop && !job.square && { crop: job.crop }), variants };
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const manifest: Record<string, Entry> = {};
const over: string[] = [];
const rows: string[] = [];
const kb = (b: number) => (b / 1024).toFixed(1).padStart(7);

for (const job of jobs) {
  if (!existsSync(job.src)) {
    if (!job.optional) throw new Error(`missing required image ${job.src}`);
    console.log(`${job.name}: ${job.src} missing, skipped`);
    continue;
  }
  const entry = await build(job);
  manifest[job.name] = entry;
  const { avif, webp, jpg } = entry.variants;
  avif.forEach((a, i) => rows.push(
    `${`${job.name}-${a.w}`.padEnd(32)}${kb(a.bytes)}${kb(webp[i].bytes)}${kb(jpg[i].bytes)}`));
  for (const a of avif) if (a.bytes > job.budgetKB * 1024) over.push(`${a.file} is ${kb(a.bytes).trim()} KB, budget ${job.budgetKB} KB`);
}

writeFileSync('src/images.json', JSON.stringify(manifest, null, 2) + '\n');

console.log(`${'image'.padEnd(32)}${'avif'.padStart(7)}${'webp'.padStart(7)}${'jpg'.padStart(7)}   (KB)`);
console.log(rows.join('\n'));

if (over.length) {
  console.error(`\nOver budget:\n  ${over.join('\n  ')}`);
  process.exit(1);
}
