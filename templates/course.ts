// A course page as two Custom Blocks (SPEC 5.2, approved in 13.1):
// top (dist/blocks/<slug>-top.html) above course.link's Course Content, main (<slug>-main.html) below it.
// Both sit in course.link's 792px main column; course.css lays them out by that column's width.
import { esc } from '../src/components/html';
import type { Course } from '../content/schema';
import { hero } from './sections/course-hero';
import { included } from './sections/course-included';
import { units } from './sections/course-units';
import { howClassesRun } from './sections/course-how-classes-run';
import { assessment } from './sections/course-assessment';
import { trainers } from './sections/course-trainers';
import { bonus } from './sections/course-bonus';
import { fieldGuides } from './sections/course-field-guides';
import { payments } from './sections/course-payments';
import { faq } from './sections/course-faq';
import { help } from './sections/course-help';

const root = (c: Course, part: 'top' | 'main', inner: string) =>
  `<div data-cbg="${esc(c.slug)}-${part}" class="cbg-block cbg-course-page cbg-course-page--${part}">${inner}</div>`;

export const courseTop = (c: Course) => root(c, 'top', hero(c));

export const courseMain = (c: Course) => root(c, 'main', [
  included(c), units(c), howClassesRun(c), assessment(c), trainers(c), bonus(c), fieldGuides(c), payments(c), faq(c), help(c),
].join(''));
