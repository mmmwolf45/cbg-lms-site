import { esc, section } from '../../src/components/html';
import type { Card } from '../../content/schema';

// The course titles on one strip (home.css, motion.css, night.css). Decorative and hidden from screen readers:
// the course cards are the real list. Where the browser has scroll-driven animations and motion is allowed, the
// strip drifts sideways only as the page scrolls past it; two identical sets keep it wider than any screen
// plus the drift. Otherwise only the first set shows, still and wrapped.
// Each title is split into letters here, not in the browser (nothing reflows when the script arrives): they
// rise in once and fill gold near the mouse (src/motion/strip.ts). `--d` staggers the rise, 0.6 s per title.
export const letters = (title: string) => {
  const n = Math.max(1, title.replace(/ /g, '').length - 1);
  let i = 0;
  return [...title].map((ch) => (ch === ' ' ? ' ' : `<span style="--d:${((0.6 * i++) / n).toFixed(2)}s">${esc(ch)}</span>`)).join('');
};

export function disciplines(cards: Card[]) {
  const set = `<span class="cbg-marquee__set">${cards.map((c) => `<span><span class="cbg-strip__n">${letters(c.title)}</span></span>`).join('')}</span>`;
  return section('disciplines', `<div class="cbg-marquee cbg-strip"><div class="cbg-marquee__track">${set.repeat(2)}</div></div>`, ' aria-hidden="true"');
}
