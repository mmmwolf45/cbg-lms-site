import { arrow, esc, logo, picture } from '../../src/components/html';
import type { Course } from '../../content/schema';
import { courseSection, twoTone } from './course-shared';

// Closing band: the closing-plate photo, lazy and decorative, under a dark gradient. The logo strip
// is a plain dark area (background inline, so the white IOSH mark never lands on white).
export const help = ({ help: s }: Course) => courseSection('help', `<div class="cbg-frame" data-cbg-reveal><div class="cbg-closing"><div class="cbg-closing__main">
${picture('closing-plate', { cls: 'cbg-closing__bg', alt: '', sizes: '(min-width: 1280px) 792px, 100vw' })}
<div class="cbg-closing__body">
<h2 class="cbg-h2">${twoTone(s.heading)}</h2>
<div class="cbg-btns"><a class="cbg-btn cbg-btn--primary" href="${esc(s.whatsapp.href)}">${esc(s.whatsapp.label)} <span class="cbg-btn__num">${esc(s.whatsapp.number)}</span>${arrow}</a></div>
<p class="cbg-closing__email"><span>${esc(s.email.label)}</span> <a href="${esc(s.email.href)}">${esc(s.email.address)}</a></p>
</div></div>
<div class="cbg-closing__logos" style="background:#081226">${s.logos.map((l) => logo(l.file, l.alt, 'sm')).join('')}</div>
</div></div>`);
