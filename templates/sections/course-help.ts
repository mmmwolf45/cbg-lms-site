import { PAGES, arrow, esc, picture } from '../../src/components/html';
import type { Course } from '../../content/schema';
import { courseSection, twoTone } from './course-shared';

// The files named in help.logos, as published from public/brand/ (same files as the home about section):
// the CBG mark resized to 160px, the IOSH 1003 mark exactly as supplied. w and h are the display size.
// Move the alt text to the YAML if logos become objects there.
const LOGOS: Record<string, { src: string; w: number; h: number; alt: string }> = {
  'cbg-mark-512.png': { src: 'brand/cbg-mark-160.png', w: 64, h: 64, alt: 'CBG Training Institute' },
  'iosh-1003-white.png': { src: 'brand/iosh-1003-white.png', w: 160, h: 80, alt: 'IOSH Approved Study Centre 1003' },
};

const logo = (file: string) => {
  const l = LOGOS[file];
  if (!l) throw new Error(`help.logos: no published file for ${file}`);
  return `<img src="${PAGES}${l.src}" width="${l.w}" height="${l.h}" alt="${esc(l.alt)}" loading="lazy" decoding="async">`;
};

// Closing band: the closing-plate photo, lazy and decorative, under a dark gradient. The logo strip
// is a plain dark area (background inline, so the white IOSH mark never lands on white).
export const help = ({ help: s }: Course) => courseSection('help', `<div class="cbg-frame" data-cbg-reveal><div class="cbg-closing"><div class="cbg-closing__main">
${picture('closing-plate', { cls: 'cbg-closing__bg', alt: '', sizes: '(min-width: 1280px) 792px, 100vw' })}
<div class="cbg-closing__body">
<h2 class="cbg-h2">${twoTone(s.heading)}</h2>
<div class="cbg-btns"><a class="cbg-btn cbg-btn--primary" href="${esc(s.whatsapp.href)}">${esc(s.whatsapp.label)} <span class="cbg-btn__num">${esc(s.whatsapp.number)}</span>${arrow}</a></div>
<p class="cbg-closing__email"><span>${esc(s.email.label)}</span> <a href="${esc(s.email.href)}">${esc(s.email.address)}</a></p>
</div></div>
<div class="cbg-closing__logos" style="background:#081226">${s.logos.map(logo).join('')}</div>
</div></div>`);
