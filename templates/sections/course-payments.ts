import { esc } from '../../src/components/html';
import type { Course } from '../../content/schema';
import { ICONS, courseSection, icon, twoTone } from './course-shared';

// A calm note card: no alarm colours, one quiet icon.
export const payments = ({ payments: s }: Course) => courseSection('payments', `<div class="cbg-card cbg-calm" data-cbg-reveal>
<span class="cbg-calm__icon">${icon(ICONS.note)}</span>
<div><h2 class="cbg-h2">${twoTone(s.heading)}</h2><p>${esc(s.body)}</p></div>
</div>`);
