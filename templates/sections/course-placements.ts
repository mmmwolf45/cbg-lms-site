import { esc } from '../../src/components/html';
import type { Section } from '../../content/schema';
import { courseSection, head } from './course-shared';
import { face } from './course-testimonials';

type Person = Section<'placements'>['people'][number];

const pill = (p: Person) => `<li class="cbg-pill">${face(p.name, p.photo)}<span><b>${esc(p.name)}</b><span>${esc(p.role)}${p.company ? ` · ${esc(p.company)}` : ''}</span></span></li>`;

// The placement wall. The list is the real content: a wrapped grid of pills without JS and under reduced
// motion. With motion, src/motion/qs-sections.ts copies the pills into data-cbg-wall="<rows>" rows
// (aria-hidden) that drift in opposite directions as the page scrolls, and the list stays for screen
// readers only. Fewer than 9 people stay a still grid.
export const placements = (s: Section<'placements'>) => {
  const n = s.people.length;
  const rows = n >= 24 ? 3 : n >= 9 ? 2 : 0;
  return courseSection('placements', `${head(s.heading, s.intro)}
<div class="cbg-wall"${rows ? ` data-cbg-wall="${rows}"` : ''}><ul class="cbg-wall__list">${s.people.map(pill).join('')}</ul></div>
${s.note ? `<p class="cbg-small cbg-fine">${esc(s.note)}</p>` : ''}`);
};
