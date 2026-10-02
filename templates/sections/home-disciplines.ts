import { esc, section } from '../../src/components/html';
import type { Card } from '../../content/schema';

// The course titles as one slow marquee (home.css). Decorative and hidden from screen readers: the course
// cards are the real list. Four identical sets, so sliding the track by half (two sets, wider than any
// screen) loops seamlessly. Under reduced motion only the first set shows, still.
export function disciplines(cards: Card[]) {
  const set = `<span class="cbg-marquee__set">${cards.map((c) => `<span>${esc(c.title)}</span>`).join('')}</span>`;
  return section('disciplines', `<div class="cbg-marquee"><div class="cbg-marquee__track">${set.repeat(4)}</div></div>`, ' aria-hidden="true"');
}
