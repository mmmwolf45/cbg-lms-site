import { PAGES, arrow, esc, section } from '../../src/components/html';
import type { Home } from '../../content/schema';

// The files named in about.logos, as published from public/brand/: the CBG mark resized to 160px,
// the IOSH 1003 mark exactly as supplied. w and h are the display size (the files are larger, for sharp screens).
const LOGOS: Record<string, { src: string; w: number; h: number; alt: string }> = {
  'cbg-mark-512.png': { src: 'brand/cbg-mark-160.png', w: 72, h: 72, alt: 'CBG Training Institute' },
  'iosh-1003-white.png': { src: 'brand/iosh-1003-white.png', w: 200, h: 100, alt: 'IOSH Approved Study Centre 1003' },
};

// Bold the highlight wherever it appears in the body (both escaped the same way first).
const bold = (body: string, hl?: string) =>
  hl ? esc(body).split(esc(hl)).join(`<strong>${esc(hl)}</strong>`) : esc(body);

const logo = (file: string) => {
  const l = LOGOS[file];
  if (!l) throw new Error(`about.logos: no published file for ${file}`);
  return `<img class="cbg-logo" src="${PAGES}${l.src}" width="${l.w}" height="${l.h}" alt="${esc(l.alt)}" loading="lazy" decoding="async">`;
};

// The logo panel's dark background is inline so the white IOSH mark never lands on white,
// even if our stylesheet hasn't loaded.
export const about =({ about: s }: Home) => section('about', `<div class="cbg-about__grid">
<div data-cbg-reveal>
<h2 class="cbg-h2">${esc(s.heading)}</h2>
<p class="cbg-about__body">${bold(s.body, s.highlight)}</p>
<a class="cbg-link" href="${esc(s.link.href)}">${esc(s.link.label)}${arrow}</a>
</div>
<div class="cbg-logos" style="background:#081226" data-cbg-reveal>${s.logos.map(logo).join('')}</div>
</div>`);
