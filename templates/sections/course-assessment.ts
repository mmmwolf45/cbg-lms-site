import { esc } from '../../src/components/html';
import type { Course } from '../../content/schema';
import { counted, courseSection, head } from './course-shared';

type Assessment = Course['assessment']['assessments'][number];

// A small pie with this task's quarter filled: four tasks, four quarters.
const QUARTERS = ['M12 12V4a8 8 0 0 1 8 8z', 'M12 12h8a8 8 0 0 1-8 8z', 'M12 12v8a8 8 0 0 1-8-8z', 'M12 12H4a8 8 0 0 1 8-8z'];
const pie = (i: number) => `<svg class="cbg-pie" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8"/><path d="${QUARTERS[i % 4]}"/></svg>`;

const card = (a: Assessment) => `<article class="cbg-card cbg-exam">
<p class="cbg-tag">${esc(a.label)}</p>
<h3 class="cbg-h3">${esc(a.title)}</h3>
<ul class="cbg-points">${a.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
</article>`;

// data-cbg-quadrants: T25 fills the four tiles one after another, each counting to its marks.
const tasks = (a: Assessment) => (a.tasks?.length ? `<div class="cbg-tasks">
${a.tasksIntro ? `<h3 class="cbg-tasks__title">${esc(a.tasksIntro)}</h3>` : ''}
<ul class="cbg-quads" data-cbg-quadrants>${a.tasks.map((t, i) =>
  `<li>${pie(i)}<span class="cbg-quads__name">${esc(t.name)}</span><b>${counted(t.marks)}</b></li>`).join('')}</ul>
${a.tasksNote ? `<p class="cbg-small">${esc(a.tasksNote)}</p>` : ''}
</div>` : '');

export const assessment = ({ assessment: s }: Course) => courseSection('assessment', `${head(s.heading, s.intro)}
<div class="cbg-exams" data-cbg-reveal="stagger">${s.assessments.map(card).join('')}</div>
${s.assessments.map(tasks).join('')}
<p class="cbg-callout" data-cbg-reveal>${esc(s.techIoshNote)}</p>`);
