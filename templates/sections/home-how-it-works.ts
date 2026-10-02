import { esc, section } from '../../src/components/html';
import type { Home } from '../../content/schema';

export const howItWorks = ({ 'how-it-works': s }: Home) => section('how-it-works', `
<div class="cbg-section-head" data-cbg-reveal><h2 class="cbg-h2">${esc(s.heading)}</h2></div>
<ol class="cbg-steps" data-cbg-thread data-cbg-reveal="stagger">${s.steps.map((step, i) =>
  `<li class="cbg-step"><span class="cbg-node" aria-hidden="true">${i + 1}</span><h3 class="cbg-h3">${esc(step.title)}</h3><p>${esc(step.body)}</p></li>`).join('')}</ol>`);
