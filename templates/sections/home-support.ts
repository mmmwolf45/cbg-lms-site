import { arrow, esc, picture, section } from '../../src/components/html';
import type { Home } from '../../content/schema';

// The plate's light layers (src/motion/support.ts, night.css) are decorative: a gold spotlight and a faint
// glare between the photo and the text (laptop mouse only), and a slow light round the border.
export const support = ({ support: s }: Home) => section('support', `<div class="cbg-frame" data-cbg-reveal><div class="cbg-plate">
${picture('closing-plate', { cls: 'cbg-plate__bg', alt: '', sizes: '(min-width: 1240px) 1160px, 100vw' })}
<i class="cbg-plate__spot" aria-hidden="true"></i><i class="cbg-plate__glare" aria-hidden="true"></i>
<div class="cbg-plate__body">
<h2 class="cbg-h2">${esc(s.heading)}</h2>
<p class="cbg-lead">${esc(s.body)}</p>
<div class="cbg-btns"><a class="cbg-btn cbg-btn--primary" href="${esc(s.whatsapp.href)}">${esc(s.whatsapp.label)} <span class="cbg-btn__note">${esc(s.whatsapp.number)}</span>${arrow}</a></div>
<ul class="cbg-contacts">${s.emails.map((e) =>
  `<li><span class="cbg-small">${esc(e.label)}</span> <a href="${esc(e.href)}">${esc(e.address)}</a></li>`).join('')}</ul>
</div><i class="cbg-plate__beam" aria-hidden="true"><i></i></i></div></div>`);
