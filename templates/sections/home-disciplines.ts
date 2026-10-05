import { esc, section } from '../../src/components/html';
import type { Card } from '../../content/schema';

// The course titles on one strip (home.css, motion.css, night.css). Decorative and hidden from screen readers:
// the course cards are the real list. Where the browser has scroll-driven animations and motion is allowed, the
// strip drifts sideways only as the page scrolls past it; two identical sets keep it wider than any screen
// plus the drift. Otherwise only the first set shows, still and wrapped.
// The outlined strip (OUTLINED below) splits each title into letters here, not in the browser (nothing reflows
// when the script arrives): they rise in once and fill gold near the mouse (src/motion/strip.ts). `--d` staggers
// the rise, 0.6 s per title.
export const letters = (title: string) => {
  const n = Math.max(1, title.replace(/ /g, '').length - 1);
  let i = 0;
  return [...title].map((ch) => (ch === ' ' ? ' ' : `<span style="--d:${((0.6 * i++) / n).toFixed(2)}s">${esc(ch)}</span>`)).join('');
};

// Which strip ships. Build B (lite, 6 Oct 2026): the plain drifting titles, as live at 56e2fa0. To bring back the
// outlined titles that rise in and fill gold near the mouse: set OUTLINED to true and add `strip`
// (src/motion/strip.ts) to the enhancers in src/page-enhancers/home.ts. night.css styles only .cbg-strip, and the
// specs check whichever strip the page has (tests/templates.test.ts, e2e/night.spec.ts).
export const OUTLINED = false;

export function disciplines(cards: Card[], outlined = OUTLINED) {
  const name = (t: string) => (outlined ? `<span><span class="cbg-strip__n">${letters(t)}</span></span>` : `<span>${esc(t)}</span>`);
  const set = `<span class="cbg-marquee__set">${cards.map((c) => name(c.title)).join('')}</span>`;
  return section('disciplines', `<div class="cbg-marquee${outlined ? ' cbg-strip' : ''}"><div class="cbg-marquee__track">${set.repeat(2)}</div></div>`, ' aria-hidden="true"');
}
