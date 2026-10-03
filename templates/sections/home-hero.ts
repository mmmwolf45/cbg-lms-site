import { PAGES, arrow, esc, picture } from '../../src/components/html';
import { FRAMES, OUT } from '../../scripts/explode-frames';
import type { Home } from '../../content/schema';

// The headline as words and letters for the exploding-building hero (SPEC section 5.1.1). Letters are
// spans so the explosion can open the spacing with transforms (src/motion/explode.ts); the real heading
// text is the sr-only copy in the h1. Three fixed lines on every screen, so the line count never depends
// on font metrics (a giant headline that re-wraps when Plus Jakarta Sans arrives is a large layout shift):
// - with "CBG": first word / up to "CBG" (gold) / the rest (muted);
// - without it (since 3 Oct 2026, "Welcome / to your / classroom"): first word / the middle / the last
//   word, which carries the gold (the CBG mark behind the building names the institute).
export function words(text: string) {
  const parts = text.split(/\s+/).filter(Boolean);
  const cbg = parts.indexOf('CBG');
  const gold = cbg >= 0 ? cbg : parts.length - 1;
  const word = (w: string, i: number) => {
    const tone = i === gold ? 'gold' : cbg >= 0 && i > cbg ? 'dim' : 'white';
    const letters = [...w].map((ch) => `<span class="cbg-l">${esc(ch)}</span>`).join('');
    return `<span class="cbg-w cbg-w--${tone}">${letters}</span>`;
  };
  const cut = cbg >= 1 ? [1, cbg + 1] : [1, Math.max(1, parts.length - 1)];
  const lines = [parts.slice(0, cut[0]), parts.slice(cut[0], cut[1]), parts.slice(cut[1])].filter((l) => l.length);
  let i = 0;
  return lines.map((l) => `<span class="cbg-explode__line">${l.map((w) => word(w, i++)).join(' ')}</span>`).join('');
}

// No .cbg-wrap: the stage spans the full block width. The tall .cbg-explode gives the sticky stage half a
// screen of scrolling to play the footage (only while the script runs; see home.css).
export const hero = ({ hero: h }: Home) => `<section id="cbg-hero" class="cbg-section cbg-hero" data-cbg-section="hero" data-cbg-hero data-cbg-explode="${PAGES}${OUT.replace(/^public\//, '')}/" data-cbg-frames="${FRAMES}">
<div class="cbg-explode"><div class="cbg-explode__stage">
<div class="cbg-explode__film"><img class="cbg-explode__mark" src="${PAGES}brand/cbg-mark-900.webp" width="900" height="900" alt="" fetchpriority="low">${picture('hero-explode-poster', {
  cls: 'cbg-explode__poster', alt: h.imageAlt, eager: true, sizes: '(min-width: 768px) 94vh, 118vw',
})}<canvas class="cbg-explode__canvas" width="960" height="960" aria-hidden="true"></canvas></div>
<div class="cbg-explode__headline"><h1 class="cbg-explode__title"><span class="cbg-sr-only">${esc(h.heading)}</span><span class="cbg-explode__words" aria-hidden="true">${words(h.heading)}</span></h1></div>
<p class="cbg-chip cbg-explode__chip">${esc(h.eyebrow)}</p>
<p class="cbg-explode__sub">${esc(h.subhead)}</p>
<div class="cbg-btns cbg-explode__btns"><a class="cbg-btn cbg-btn--primary" href="#navbar" data-cbg-action="${esc(h.primaryCta.action ?? 'login')}">${esc(h.primaryCta.label)}${arrow}</a><a class="cbg-btn cbg-btn--ghost" href="${esc(h.secondaryCta.href)}">${esc(h.secondaryCta.label)}</a></div>
</div></div>
</section>`;
