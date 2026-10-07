// Any course page, from its content/courses/<slug>.yaml alone, as two Custom Blocks (SPEC 5.2, approved in 13.1):
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
import { xray } from './sections/course-xray';
import { certificates } from './sections/course-certificates';
import { testimonials } from './sections/course-testimonials';
import { placements } from './sections/course-placements';
import { careers } from './sections/course-careers';
import { bowtie } from './sections/course-bowtie';

const root = (c: Course, part: 'top' | 'main', inner: string) =>
  `<div data-cbg="${esc(c.slug)}-${part}" class="cbg-block cbg-course-page cbg-course-page--${part}">${inner}</div>`;

export const courseTop = (c: Course) => root(c, 'top', hero(c));

// A section the course's YAML leaves out renders nothing.
const opt = <T>(data: T | undefined, render: (data: T) => string) => (data ? render(data) : '');

// In SPEC 5.2 page order (the order of content/schema.ts).
export const courseMain = (c: Course) => root(c, 'main', [
  opt(c.bowtie, bowtie), opt(c.included, included), opt(c.units, units), opt(c.xray, xray), opt(c['how-classes-run'], howClassesRun),
  opt(c.assessment, assessment), opt(c.certificates, certificates), opt(c.trainers, trainers),
  opt(c.testimonials, testimonials), opt(c.placements, placements), opt(c.careers, careers), opt(c.bonus, bonus), opt(c['field-guides'], fieldGuides), opt(c.payments, payments),
  opt(c.faq, faq), opt(c.help, help),
].join(''));
