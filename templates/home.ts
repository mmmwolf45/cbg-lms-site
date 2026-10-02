// The home page as one Custom Block (dist/blocks/home.html). Sections in content order.
import type { Course, Home } from '../content/schema';
import { hero } from './sections/home-hero';
import { howItWorks } from './sections/home-how-it-works';
import { courses } from './sections/home-courses';
import { firstSteps } from './sections/home-first-steps';
import { support } from './sections/home-support';
import { about } from './sections/home-about';
import { footerNote } from './sections/home-footer-note';

export const home = (h: Home, list: Course[]) => `<div data-cbg="home" class="cbg-block">${[
  hero(h), howItWorks(h), courses(h, list), firstSteps(h), support(h), about(h), footerNote(h),
].join('')}</div>`;
