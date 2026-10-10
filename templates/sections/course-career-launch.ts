import { esc } from '../../src/components/html';
import type { Section } from '../../content/schema';
import { courseSection, head } from './course-shared';

type Part = Section<'career-launch'>['stages'][number]['parts'][number];

const part = (p: Part) => `<li class="cbg-card cbg-launch__part">
<h4 class="cbg-launch__title">${esc(p.title)}</h4>
<p>${esc(p.body)}</p>
${p.link ? `<a class="cbg-link" href="${esc(p.link.href)}" target="_blank" rel="noopener">${esc(p.link.label)}</a>` : ''}
</li>`;

// Career Launch Support: one column per stage (numbered, in order: Get Ready, Get Seen, Get Connected), its parts
// as small cards, and the no-guarantee line as a callout underneath.
export const careerLaunch = (s: Section<'career-launch'>) => courseSection('career-launch', `${head(s.heading, s.intro)}
<ol class="cbg-launch" data-cbg-reveal="stagger">${s.stages.map((st, i) => `<li class="cbg-launch__stage">
<h3 class="cbg-launch__name"><span class="cbg-launch__num" aria-hidden="true">${i + 1}</span>${esc(st.name)}</h3>
<ul class="cbg-launch__parts">${st.parts.map(part).join('')}</ul>
</li>`).join('')}</ol>
<p class="cbg-callout" data-cbg-reveal>${esc(s.note)}</p>`);
