import { esc } from '../../src/components/html';
import type { Course } from '../../content/schema';
import { ICONS, courseSection, head, icon, nth } from './course-shared';

// Our own stylised seal for the featured card: rings and a star. Never IOSH certificate artwork.
const seal = '<svg class="cbg-seal" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle cx="60" cy="60" r="56" stroke-dasharray="1.5 4.5"/><circle cx="60" cy="60" r="47"/><circle cx="60" cy="60" r="41" stroke-dasharray="1 3"/><path d="M60 35l7.3 14.8 16.3 2.4-11.8 11.5 2.8 16.3L60 72.3l-14.6 7.7 2.8-16.3-11.8-11.5 16.3-2.4z"/></svg>';

const KIT = [ICONS.stack, ICONS.book, ICONS.slides, ICONS.clipboard];

type Card = Course['included']['cards'][number];

const card = (c: Card, i: number) => `<li class="cbg-card cbg-kit${c.featured ? ' cbg-card--feat' : ''}">
${c.featured ? `<span class="cbg-kit__icon">${icon(ICONS.seal)}</span>${seal}` : `<span class="cbg-kit__icon">${icon(nth(KIT, i))}</span>`}
<h3 class="cbg-h3">${esc(c.title)}</h3>
<p>${esc(c.body)}</p>
</li>`;

// data-cbg-hand: T23 fans these cards into a hand and deals them into the grid.
export const included = ({ included: s }: Course) => {
  let k = 0; // icon index over the non-featured cards only
  return courseSection('included', `${head(s.heading, s.intro)}
<ul class="cbg-kits" data-cbg-hand>${s.cards.map((c) => card(c, c.featured ? 0 : k++)).join('')}</ul>`);
};
