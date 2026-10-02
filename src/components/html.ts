// Small helpers for the build-time templates (templates/*). Output is static HTML strings.
import images from '../images.json';

// Blocks are pasted into course.link, so every asset URL is absolute on the Pages base.
export const PAGES = 'https://mmmwolf45.github.io/cbg-lms-site/';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: string | number) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

// One section, per docs/markup-contract.md. `attrs` is extra raw attribute text (e.g. ' data-cbg-hero').
export const section = (id: string, inner: string, attrs = '') =>
  `<section id="cbg-${id}" class="cbg-section cbg-${id}" data-cbg-section="${id}"${attrs}><div class="cbg-wrap">${inner}</div></section>`;

export const arrow =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

type ImageName = keyof typeof images;
type Variant = { w: number; file: string };

const srcset = (list: Variant[]) => list.map((v) => `${PAGES}${v.file} ${v.w}w`).join(',');

// AVIF, WebP and JPEG <source>s for one image; `media` makes them art-direction sources.
function sources(name: ImageName, sizes: string, media = '') {
  const { variants: v, width, height } = images[name];
  const m = media && ` media="${media}"`;
  const dims = ` width="${width}" height="${height}"`;
  return `<source type="image/avif"${m} srcset="${srcset(v.avif)}" sizes="${sizes}"${dims}>`
    + `<source type="image/webp"${m} srcset="${srcset(v.webp)}" sizes="${sizes}"${dims}>`
    + (media ? `<source${m} srcset="${srcset(v.jpg)}" sizes="${sizes}"${dims}>` : '');
}

export type PictureOpts = {
  alt: string; // '' for decorative images
  sizes: string;
  cls?: string;
  eager?: boolean; // above the fold: fetchpriority high, no lazy loading
  art?: { name: ImageName; media: string; sizes?: string }; // a different crop when `media` matches
};

export function picture(name: ImageName, o: PictureOpts) {
  const { variants: v, width, height } = images[name];
  const load = o.eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  const fallback = v.jpg[v.jpg.length - 1];
  return `<picture${o.cls ? ` class="${o.cls}"` : ''}>`
    + (o.art ? sources(o.art.name, o.art.sizes ?? o.sizes, o.art.media) : '')
    + sources(name, o.sizes)
    + `<img src="${PAGES}${fallback.file}" srcset="${srcset(v.jpg)}" sizes="${o.sizes}" width="${width}" height="${height}" alt="${esc(o.alt)}" ${load}>`
    + '</picture>';
}

// Logos by the source file the YAML names (brand/assets/), as published from public/brand/: the CBG mark
// resized to 160px, the IOSH 1003 mark exactly as supplied. Display sizes [w, h] (the files are larger,
// for sharp screens): 'lg' in the home about panel, 'sm' in the course closing band.
const LOGOS = {
  'cbg-mark-512.png': { src: 'brand/cbg-mark-160.png', lg: [72, 72], sm: [64, 64] },
  'iosh-1003-white.png': { src: 'brand/iosh-1003-white.png', lg: [200, 100], sm: [160, 80] },
} as const;

export function logo(file: string, alt: string, size: 'lg' | 'sm', cls = '') {
  const l = LOGOS[file as keyof typeof LOGOS];
  if (!l) throw new Error(`logos: no published file for ${file}`);
  const [w, h] = l[size];
  return `<img${cls ? ` class="${cls}"` : ''} src="${PAGES}${l.src}" width="${w}" height="${h}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
}
