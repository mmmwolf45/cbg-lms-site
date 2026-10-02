import { esc } from '../../src/components/html';
import type { Section } from '../../content/schema';
import { courseSection, head } from './course-shared';

// Native <details>, all closed, so it works without JS. data-cbg-faq: T21 adds the height animation.
export const faq = (s: Section<'faq'>) => courseSection('faq', `${head(s.heading)}
<div class="cbg-faq" data-cbg-faq>${s.items.map((it) =>
  `<details><summary>${esc(it.q)}</summary><p>${esc(it.a)}</p></details>`).join('')}</div>`);
