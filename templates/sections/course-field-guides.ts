import { esc } from '../../src/components/html';
import type { Course } from '../../content/schema';
import { courseSection, head } from './course-shared';

type Released = Course['field-guides']['released'][number];

// Covers are drawn in HTML/CSS, no images. Released guides in full colour; upcoming ones outlined.
// A line warning sign on the released cover (decorative).
const sign = '<svg class="cbg-cover__sign" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.5 21.5 20h-19zM12 10v4.5M12 17v.5"/></svg>';

const released = (g: Released) => `<li class="cbg-cover cbg-cover--out">
${sign}
<p class="cbg-cover__label">${esc(g.label)}</p>
<h3 class="cbg-cover__title">${esc(g.title)}</h3>
${g.subtitle ? `<p class="cbg-cover__sub">${esc(g.subtitle)}</p>` : ''}
</li>`;

const upcoming = (soon: string, title?: string) => `<li class="cbg-cover">
<p class="cbg-cover__label">${esc(soon)}</p>
${title ? `<p class="cbg-cover__title">${esc(title)}</p>` : ''}
</li>`;

// data-cbg-shelf: T25 fans the shelf open from a stack. On narrow columns the shelf is a
// scroll-snap row; tabindex + role + aria-label make it reachable and scrollable with arrow keys.
export const fieldGuides = ({ 'field-guides': s }: Course) => {
  const soon = [...s.upcoming.map((t) => upcoming(s.comingSoonLabel, t)),
    ...Array.from({ length: s.unnamedUpcoming }, () => upcoming(s.comingSoonLabel))];
  return courseSection('field-guides', `${head(s.heading, s.body)}
<div class="cbg-shelf" data-cbg-shelf tabindex="0" role="region" aria-label="${esc(s.heading)}">
<div class="cbg-shelf__group"><p class="cbg-shelf__label">${esc(s.releasedLabel)}</p><ul>${s.released.map(released).join('')}</ul></div>
<div class="cbg-shelf__group"><p class="cbg-shelf__label">${esc(s.upcomingLabel)}</p><ul>${soon.join('')}</ul></div>
</div>`);
};
