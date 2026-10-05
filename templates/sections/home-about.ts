import { PAGES, arrow, esc, logo, section } from '../../src/components/html';
import type { Home } from '../../content/schema';

// Bold the highlight wherever it appears in the body (both escaped the same way first).
const bold = (body: string, hl?: string) =>
  hl ? esc(body).split(esc(hl)).join(`<strong>${esc(hl)}</strong>`) : esc(body);

// The logo panel's dark background is inline so a white mark (e.g. the IOSH one, if ever listed) never lands on white,
// even if our stylesheet hasn't loaded. The globe (src/motion/globe.ts, night.css) is a decorative layer: a canvas
// and the CBG mark as a medallion. It shows once the globe has drawn; until then (and without WebGL) the flat
// mark does, and the flat mark stays in the page for screen readers either way. The reveal is on a wrapper, so
// the panel's own layers can fade without looking like an unrevealed element.
const globe = '<div class="cbg-globe" data-cbg-globe aria-hidden="true"><div class="cbg-globe__orb"><canvas></canvas>'
  + `<span class="cbg-globe__medal"><img src="${PAGES}brand/cbg-mark-900.webp" width="900" height="900" alt="" loading="lazy" decoding="async"></span></div></div>`;

export const about = ({ about: s }: Home) => section('about', `<div class="cbg-about__grid">
<div data-cbg-reveal>
<h2 class="cbg-h2">${esc(s.heading)}</h2>
<p class="cbg-about__body">${bold(s.body, s.highlight)}</p>
<a class="cbg-link" href="${esc(s.link.href)}">${esc(s.link.label)}${arrow}</a>
</div>
<div data-cbg-reveal><div class="cbg-logos cbg-logos--globe" style="background:#081226">${globe}${s.logos.map((l) => logo(l.file, l.alt, 'lg', 'cbg-logo')).join('')}</div></div>
</div>`);
