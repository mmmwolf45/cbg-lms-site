import { esc } from '../../src/components/html';
import type { Section } from '../../content/schema';
import { ICONS, courseSection, head, icon, nth } from './course-shared';

// One icon per item, by position (cycling if there are more items): video call, calendar, book, chat, laptop.
const ICON_ORDER = [ICONS.video, ICONS.calendar, ICONS.book, ICONS.chat, ICONS.laptop];

export const howClassesRun = (s: Section<'how-classes-run'>) => courseSection('how-classes-run', `${head(s.heading)}
<ul class="cbg-ways" data-cbg-reveal="stagger">${s.items.map((it, i) =>
  `<li><span class="cbg-ways__icon">${icon(nth(ICON_ORDER, i))}</span><h3 class="cbg-h3">${esc(it.title)}</h3><p>${esc(it.body)}</p></li>`).join('')}</ul>
<p class="cbg-note" data-cbg-reveal><strong>${esc(s.timetable.label)}:</strong> ${esc(s.timetable.text)}</p>`);
