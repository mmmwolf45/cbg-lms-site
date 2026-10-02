import { arrow, esc, picture, section } from '../../src/components/html';
import type { Home } from '../../content/schema';

// "Welcome to your CBG classroom": from "CBG" on is the dimmed second line, with "CBG" in gold.
function headline(text: string) {
  const at = text.indexOf('CBG');
  if (at < 0) return esc(text);
  return `${esc(text.slice(0, at).trimEnd())} <span class="cbg-dim"><span class="cbg-gold">CBG</span>${esc(text.slice(at + 3))}</span>`;
}

export const hero = ({ hero: h }: Home) => section('hero', `<div class="cbg-hero__grid">
<div class="cbg-hero__copy">
<p class="cbg-chip">${esc(h.eyebrow)}</p>
<h1 class="cbg-display">${headline(h.heading)}</h1>
<p class="cbg-lead">${esc(h.subhead)}</p>
<div class="cbg-btns"><a class="cbg-btn cbg-btn--primary" href="#navbar" data-cbg-action="${esc(h.primaryCta.action ?? 'login')}">${esc(h.primaryCta.label)}${arrow}</a><a class="cbg-btn cbg-btn--ghost" href="${esc(h.secondaryCta.href)}">${esc(h.secondaryCta.label)}</a></div>
</div>
<div class="cbg-hero__visual">${picture('hero-structure', {
  cls: 'cbg-hero__media', alt: h.imageAlt, eager: true, sizes: '62vw',
  art: { name: 'hero-structure-phone', media: '(max-width: 1023px)', sizes: '100vw' },
})}<svg class="cbg-hero__lines" width="0" height="0" aria-hidden="true" focusable="false"></svg></div>
</div>`, ' data-cbg-hero');
