import { esc, section } from '../../src/components/html';
import type { Home } from '../../content/schema';

// One stroked path per tick (pathLength 1), so T16 can draw it with stroke-dashoffset.
const tick = '<svg class="cbg-tick" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path pathLength="1" d="M6.5 12.5l3.5 3.5 7.5-8"/></svg>';

export const firstSteps = ({ 'first-steps': s }: Home) => section('first-steps', `
<div class="cbg-section-head" data-cbg-reveal><h2 class="cbg-h2">${esc(s.heading)}</h2></div>
<ul class="cbg-checklist" data-cbg-ticks>${s.items.map((item) => `<li>${tick}<span>${esc(item)}</span></li>`).join('')}</ul>`);
