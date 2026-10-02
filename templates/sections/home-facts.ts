import { esc } from '../../src/components/html';
import type { Card, Home } from '../../content/schema';
import { counted } from './course-shared';

// Three facts under the hero: courses and languages counted from the course files, then delivery as
// written. Written out rather than through section(), whose class would be `cbg-facts` (the course
// page's fact grid).
export function facts({ facts: f }: Home, cards: Card[]) {
  const languages = new Set(cards.flatMap((c) => c.languages ?? [])).size;
  const stat = (value: string, label: string) => `<li class="cbg-stat"><b>${value}</b><span>${esc(label)}</span></li>`;
  return '<section id="cbg-facts" class="cbg-section cbg-home-facts" data-cbg-section="facts"><div class="cbg-wrap">'
    + `<ul class="cbg-stats" data-cbg-reveal="stagger">${stat(counted(cards.length), f.courses)}${stat(counted(languages), f.languages)}`
    + `${stat(esc(f.delivery.value), f.delivery.label)}</ul></div></section>`;
}
