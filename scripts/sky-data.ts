// Builds public/sky/stars.bin, the real star field for the page background (src/motion/sky.ts).
// Sources (brand/assets/CREDITS.md):
//   Yale Bright Star Catalogue, 5th rev. ed. (Hoffleit & Warren 1991, CDS V/50): public domain
//   (NASA HEASARC lists it under https://www.usa.gov/government-works).
//   Constellation stick figures: d3-celestial data/constellations.lines.json, (c) 2015 Olaf Frohn, BSD-3-Clause.
// Run when the selection changes; output is committed.   npx tsx scripts/sky-data.ts
//
// Layout (little-endian): u16 stars, u16 segments, then per star u16 RA (0..2pi), u16 Dec (-90..90 deg),
// then u8 V magnitude ((m + 2) * 25), u8 B-V ((bv + 0.5) * 60), then u16 pairs of star indices.
import { mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const BSC = 'https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz';
const LINES = 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json';
export const MAG = 5.8; // faintest star kept (about 3,900 stars)
const SOUTH = -65; // Dec below this never rises at Doha (25.3 N)
const FIGURES = ['And', 'Aql', 'Ari', 'Aur', 'Boo', 'CMa', 'CMi', 'Cas', 'Cen', 'Cet', 'Cru', 'Cyg', 'Eri', 'Gem',
  'Leo', 'Lyr', 'Ori', 'Peg', 'Per', 'Sco', 'Sgr', 'Tau', 'UMa', 'UMi', 'Vir'];

type Star = { ra: number; dec: number; mag: number; bv: number };
const num = (row: string, a: number, b: number) => Number(row.slice(a - 1, b));
const blank = (row: string, a: number, b: number) => !row.slice(a - 1, b).trim();

// One catalogue row (byte columns from the CDS ReadMe); undefined for the few entries with no position.
export function parse(row: string): Star | undefined {
  if (blank(row, 76, 77) || blank(row, 103, 107)) return undefined;
  const ra = (num(row, 76, 77) + num(row, 78, 79) / 60 + num(row, 80, 83) / 3600) * 15;
  const dec = (row[83] === '-' ? -1 : 1) * (num(row, 85, 86) + num(row, 87, 88) / 60 + num(row, 89, 90) / 3600);
  return { ra, dec, mag: num(row, 103, 107), bv: blank(row, 110, 114) ? 0.6 : num(row, 110, 114) };
}

const angle = (a: Star, ra: number, dec: number) => {
  const r = Math.PI / 180;
  const c = Math.sin(a.dec * r) * Math.sin(dec * r) + Math.cos(a.dec * r) * Math.cos(dec * r) * Math.cos((a.ra - ra) * r);
  return Math.acos(Math.min(1, c)) / r;
};

async function main() {
  const rows = gunzipSync(Buffer.from(await (await fetch(BSC)).arrayBuffer())).toString('latin1').split('\n');
  const all = rows.map(parse).filter((s): s is Star => !!s && s.dec > SOUTH);
  const keep = new Set(all.filter((s) => s.mag <= MAG));
  const geo = (await (await fetch(LINES)).json()) as { features: { id: string; geometry: { coordinates: number[][][] } }[] };
  // Each figure vertex is matched to the nearest catalogue star (kept even if fainter than MAG).
  const pairs: [Star, Star][] = [];
  for (const f of geo.features.filter((f) => FIGURES.includes(f.id))) {
    for (const line of f.geometry.coordinates) {
      const pts = line.map(([ra, dec]) => {
        const s = all.reduce((b, s) => (angle(s, (ra + 360) % 360, dec) < angle(b, (ra + 360) % 360, dec) ? s : b));
        if (angle(s, (ra + 360) % 360, dec) > 0.3) throw new Error(`${f.id}: no star near ${ra} ${dec}`);
        keep.add(s);
        return s;
      });
      for (let i = 1; i < pts.length; i++) pairs.push([pts[i - 1], pts[i]]);
    }
  }
  const stars = [...keep].sort((a, b) => a.mag - b.mag); // brightest first
  const n = stars.length;
  const buf = Buffer.alloc(4 + 6 * n + 4 * pairs.length);
  buf.writeUInt16LE(n, 0);
  buf.writeUInt16LE(pairs.length, 2);
  stars.forEach((s, i) => {
    buf.writeUInt16LE(Math.round((s.ra / 360) * 65536) % 65536, 4 + 2 * i);
    buf.writeUInt16LE(Math.round(((s.dec + 90) / 180) * 65535), 4 + 2 * n + 2 * i);
    buf.writeUInt8(Math.round((s.mag + 2) * 25), 4 + 4 * n + i);
    buf.writeUInt8(Math.max(0, Math.min(255, Math.round((s.bv + 0.5) * 60))), 4 + 5 * n + i);
  });
  const index = new Map(stars.map((s, i) => [s, i]));
  pairs.forEach(([a, b], k) => {
    buf.writeUInt16LE(index.get(a)!, 4 + 6 * n + 4 * k);
    buf.writeUInt16LE(index.get(b)!, 6 + 6 * n + 4 * k);
  });
  mkdirSync('public/sky', { recursive: true });
  writeFileSync('public/sky/stars.bin', buf);
  console.log(`public/sky/stars.bin: ${n} stars, ${pairs.length} segments, ${buf.length} bytes`);
}

if (process.argv[1]?.endsWith('sky-data.ts')) await main();
