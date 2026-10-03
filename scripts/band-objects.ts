// Turns the floating-desk cut-outs (brand/assets/band-objects/*.png, transparent backgrounds) into the
// AVIF and WebP files the home band layers over its empty-desk photo (SPEC section 5.1, src/motion/
// band-desk.ts). Separate from scripts/images.ts because these need transparency (no JPEG) and their
// own folder (images.ts rebuilds public/img from scratch). Run it when a cut-out changes; output is committed.
//
//   npm run band-objects
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const SRC = 'brand/assets/band-objects';
export const OUT = 'public/band-desk';

// Each object at two widths (the larger for big laptop screens), and a size budget for the larger AVIF.
// size: the trimmed source in px (its aspect ratio sets the <img> height, so nothing shifts as it loads).
export const OBJECTS = {
  plans: { widths: [1000, 520], budgetKB: 60, size: [1902, 1176] },
  laptop: { widths: [1100, 560], budgetKB: 70, size: [2030, 1278] },
  helmet: { widths: [840, 440], budgetKB: 60, size: [1661, 1140] },
} as const;
export type ObjectName = keyof typeof OBJECTS;

export const objectFile = (name: string, w: number, fmt: 'avif' | 'webp') => `${name}-${w}.${fmt}`;

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const over: string[] = [];
  for (const [name, o] of Object.entries(OBJECTS)) {
    const src = join(SRC, `${name}.png`);
    for (const w of o.widths) {
      const img = sharp(src).resize(w);
      await img.clone().avif({ quality: 60, effort: 6 }).toFile(join(OUT, objectFile(name, w, 'avif')));
      await img.clone().webp({ quality: 84, alphaQuality: 95, effort: 6 }).toFile(join(OUT, objectFile(name, w, 'webp')));
      const kb = statSync(join(OUT, objectFile(name, w, 'avif'))).size / 1024;
      console.log(`${name}-${w}`.padEnd(16), `${kb.toFixed(1)} KB avif`);
      if (w === o.widths[0] && kb > o.budgetKB) over.push(`${name}-${w}.avif is ${kb.toFixed(0)} KB, budget ${o.budgetKB} KB`);
    }
  }
  if (over.length) {
    console.error(`Over budget:\n  ${over.join('\n  ')}`);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('band-objects.ts')) main().catch((err) => { console.error(err); process.exit(1); });
