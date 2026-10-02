import { arrow, esc, logo, section } from '../../src/components/html';
import type { Home } from '../../content/schema';

// Bold the highlight wherever it appears in the body (both escaped the same way first).
const bold = (body: string, hl?: string) =>
  hl ? esc(body).split(esc(hl)).join(`<strong>${esc(hl)}</strong>`) : esc(body);

// The logo panel's dark background is inline so a white mark (e.g. the IOSH one, if ever listed) never lands on white,
// even if our stylesheet hasn't loaded.
export const about =({ about: s }: Home) => section('about', `<div class="cbg-about__grid">
<div data-cbg-reveal>
<h2 class="cbg-h2">${esc(s.heading)}</h2>
<p class="cbg-about__body">${bold(s.body, s.highlight)}</p>
<a class="cbg-link" href="${esc(s.link.href)}">${esc(s.link.label)}${arrow}</a>
</div>
<div class="cbg-logos" style="background:#081226" data-cbg-reveal>${s.logos.map((l) => logo(l.file, l.alt, 'lg', 'cbg-logo')).join('')}</div>
</div>`);
