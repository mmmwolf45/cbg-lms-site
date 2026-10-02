// The home page as one Custom Block (dist/blocks/home.html). Sections in content order.
import type { CourseFile, Home } from '../content/schema';
import { hero } from './sections/home-hero';
import { facts } from './sections/home-facts';
import { disciplines } from './sections/home-disciplines';
import { howItWorks } from './sections/home-how-it-works';
import { band } from './sections/home-band';
import { courses } from './sections/home-courses';
import { support } from './sections/home-support';
import { about } from './sections/home-about';
import { footerNote } from './sections/home-footer-note';

// `list`: every course file (with a page or card only); the cards show in `card.order`.
export function home(h: Home, list: CourseFile[]) {
  const cards = list.map((c) => c.card).sort((a, b) => a.order - b.order);
  return `<div data-cbg="home" class="cbg-block">${[
    hero(h), facts(h, cards), disciplines(cards), howItWorks(h), band(h), courses(h, cards), support(h), about(h), footerNote(h),
  ].join('')}</div>`;
}
