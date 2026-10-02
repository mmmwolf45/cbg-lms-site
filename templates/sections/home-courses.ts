import { arrow, esc, section } from '../../src/components/html';
import type { Course, Home } from '../../content/schema';

const card = ({ card: c }: Course) => `<article class="cbg-card cbg-course">
<p class="cbg-course__top"><span class="cbg-tag">${esc(c.tag)}</span> <span class="cbg-status">${esc(c.status)}</span></p>
<h3 class="cbg-h3">${esc(c.title)}</h3>
<p>${esc(c.line)}</p>
<ul class="cbg-chips">${c.meta.map((m) => `<li class="cbg-chip">${esc(m)}</li>`).join('')}</ul>
<a class="cbg-btn cbg-btn--primary" href="${esc(c.cta.href)}">${esc(c.cta.label)}${arrow}</a>
</article>`;

export const courses = ({ courses: s }: Home, list: Course[]) => section('courses', `
<div class="cbg-section-head" data-cbg-reveal><h2 class="cbg-h2">${esc(s.heading)}</h2><p>${esc(s.intro)}</p></div>
<div class="cbg-course-grid" data-cbg-reveal="stagger">${list.map(card).join('')}</div>`);
