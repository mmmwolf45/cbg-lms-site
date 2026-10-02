import { esc } from '../../src/components/html';
import type { Section } from '../../content/schema';
import { counted, courseSection, head } from './course-shared';

type Assessment = Section<'assessment'>['assessments'][number];

// A small pie with this task's slice filled: n tasks, n equal slices. Four tasks use the hand-drawn quarters.
const QUARTERS = ['M12 12V4a8 8 0 0 1 8 8z', 'M12 12h8a8 8 0 0 1-8 8z', 'M12 12v8a8 8 0 0 1-8-8z', 'M12 12H4a8 8 0 0 1 8-8z'];
const at = (k: number, n: number) => {
  const a = (k / n) * 2 * Math.PI;
  return `${+(12 + 8 * Math.sin(a)).toFixed(2)} ${+(12 - 8 * Math.cos(a)).toFixed(2)}`;
};
const slice = (i: number, n: number) => (n === 4 ? QUARTERS[i]
  : n === 1 ? 'M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16z'
    : `M12 12L${at(i, n)}A8 8 0 0 1 ${at(i + 1, n)}z`);
const pie = (i: number, n: number) => `<svg class="cbg-pie" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8"/><path d="${slice(i, n)}"/></svg>`;

const card = (a: Assessment) => `<article class="cbg-card cbg-exam">
<p class="cbg-tag">${esc(a.label)}</p>
<h3 class="cbg-h3">${esc(a.title)}</h3>
<ul class="cbg-points">${a.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
</article>`;

// data-cbg-quadrants: T25 fills the tiles (two per row) one after another, each counting to its marks.
const tasks = (a: Assessment) => (a.tasks?.length ? `<div class="cbg-tasks">
${a.tasksIntro ? `<h3 class="cbg-tasks__title">${esc(a.tasksIntro)}</h3>` : ''}
<ul class="cbg-quads" data-cbg-quadrants>${a.tasks.map((t, i, all) =>
  `<li>${pie(i, all.length)}<span class="cbg-quads__name">${esc(t.name)}</span><b>${counted(t.marks)}</b></li>`).join('')}</ul>
${a.tasksNote ? `<p class="cbg-small">${esc(a.tasksNote)}</p>` : ''}
</div>` : '');

export const assessment = (s: Section<'assessment'>) => courseSection('assessment', `${head(s.heading, s.intro)}
<div class="cbg-exams" data-cbg-reveal="stagger">${s.assessments.map(card).join('')}</div>
${s.assessments.map(tasks).join('')}
${s.techIoshNote ? `<p class="cbg-callout" data-cbg-reveal>${esc(s.techIoshNote)}</p>` : ''}`);
