import { PAGES, esc, picture } from '../../src/components/html';
import images from '../../src/images.json';
import { OBJECTS, OUT, objectFile, type ObjectName } from '../../scripts/band-objects';
import type { Home } from '../../content/schema';

type ImageName = keyof typeof images;

// The floating desk (approved 4 Oct 2026, src/motion/band-desk.ts): the empty-desk photo, with the rolled
// plans, laptop and hard hat as separate cut-outs on it. Each has a resting place on the desk (home.css),
// a depth (how far it lifts) and a spin axis for a tap. Without the script they simply sit on the desk.
const DESK: { name: ObjectName; depth: number; spin: 'y' | 'z'; sizes: string }[] = [
  { name: 'plans', depth: 0.9, spin: 'z', sizes: '(max-width: 720px) 36vw, 24vw' },
  { name: 'laptop', depth: 1.15, spin: 'y', sizes: '(max-width: 720px) 48vw, 31vw' },
  { name: 'helmet', depth: 1, spin: 'y', sizes: '(max-width: 720px) 34vw, 22vw' },
];

const base = `${PAGES}${OUT.replace(/^public\//, '')}/`;
const srcset = (name: ObjectName, fmt: 'avif' | 'webp') =>
  OBJECTS[name].widths.map((w) => `${base}${objectFile(name, w, fmt)} ${w}w`).join(',');

function object({ name, depth, spin, sizes }: (typeof DESK)[number]) {
  const [w, h] = OBJECTS[name].size;
  const big = OBJECTS[name].widths[0];
  return `<div class="cbg-desk__obj cbg-desk__obj--${name}" data-cbg-desk-object data-depth="${depth}" data-spin="${spin}">`
    + '<span class="cbg-desk__shadow"></span>'
    + `<picture><source type="image/avif" srcset="${srcset(name, 'avif')}" sizes="${sizes}">`
    + `<img src="${base}${objectFile(name, big, 'webp')}" srcset="${srcset(name, 'webp')}" sizes="${sizes}" width="${w}" height="${h}" alt="" loading="lazy" decoding="async"></picture></div>`;
}

// The band's media layer holds the photo and the objects together, so the scroll parallax
// (src/motion/parallax.ts) moves them as one. Left out until `npm run images` has built its photo.
export function band({ band: b }: Home) {
  if (!b || !(b.image in images)) return '';
  return `<section id="cbg-band" class="cbg-section cbg-band" data-cbg-section="band" data-cbg-parallax><div class="cbg-wrap">`
    + `<div class="cbg-band__view" data-cbg-desk role="img" aria-label="${esc(b.alt)}"><div class="cbg-band__media cbg-desk">`
    + picture(b.image as ImageName, { cls: 'cbg-desk__plate', alt: '', sizes: '100vw' })
    + DESK.map(object).join('')
    + '</div></div></div></section>';
}
