import { esc, section } from '../../src/components/html';
import type { Card } from '../../content/schema';

// The course titles on one strip (home.css, motion.css). Decorative and hidden from screen readers: the
// course cards are the real list. Where the browser has scroll-driven animations and motion is allowed, the
// strip drifts sideways only as the page scrolls past it; two identical sets keep it wider than any screen
// plus the drift. Otherwise only the first set shows, still and wrapped.
export function disciplines(cards: Card[]) {
  const set = `<span class="cbg-marquee__set">${cards.map((c) => `<span>${esc(c.title)}</span>`).join('')}</span>`;
  return section('disciplines', `<div class="cbg-marquee"><div class="cbg-marquee__track">${set.repeat(2)}</div></div>`, ' aria-hidden="true"');
}
