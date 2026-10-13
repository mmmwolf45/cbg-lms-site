// Bakes the hero's load path (YAML scrub.path, 1600 x 900 frame pixels) into the full-size poster, which the
// laptop frames are a centre "cover" crop of. Run from the repo root.
const path = require('path');
const sharp = require(path.resolve('node_modules/sharp'));
const { parse } = require(path.resolve('node_modules/yaml'));
const fs = require('fs');
const c = parse(fs.readFileSync('content/courses/structural-design.yaml', 'utf8'));
const { lines } = c.hero.scrub.path;
(async () => {
  const src = 'brand/assets/sd-hero/poster-clean.png';
  const { width: W, height: H } = await sharp(src).metadata();
  const k = Math.max(1600 / W, 900 / H);
  const ox = (W * k - 1600) / 2, oy = (H * k - 900) / 2;
  const P = (x, y) => `${((x + ox) / k).toFixed(1)} ${((y + oy) / k).toFixed(1)}`;
  const d = (l) => l.reduce((s, v, i) => (i % 2 ? s : `${s}${i ? 'L' : 'M'}${P(l[i], l[i + 1])}`), '');
  const w = (n) => (n / k).toFixed(1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${lines.map((l) =>
    `<path d="${d(l)}" fill="none" stroke="rgba(214,177,96,.28)" stroke-width="${w(12)}" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${d(l)}" fill="none" stroke="#f3d891" stroke-width="${w(3.5)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
  await sharp(src).composite([{ input: Buffer.from(svg) }]).png().toFile('brand/assets/sd-hero/poster.png');
  console.log('poster baked', W, H, 'k', k.toFixed(4), 'oy', oy.toFixed(1));
})();
