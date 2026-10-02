import { esc } from '../../src/components/html';
import type { Section } from '../../content/schema';
import { courseSection, head } from './course-shared';

// The recommended order as a vertical path joined by the gold thread (vertical at every width: course.css).
export const bonus = (s: Section<'bonus'>) => courseSection('bonus', `${head(s.heading, s.intro)}
<ol class="cbg-steps cbg-path" data-cbg-thread data-cbg-reveal="stagger">${s.steps.map((step, i) =>
  `<li class="cbg-step"><span class="cbg-node" aria-hidden="true">${i + 1}</span><h3 class="cbg-h3">${esc(step.title)}</h3><p>${esc(step.body)}</p></li>`).join('')}</ol>
<p class="cbg-small cbg-fine">${esc(s.smallPrint)}</p>`);
