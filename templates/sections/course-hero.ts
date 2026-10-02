import { arrow, esc, picture } from '../../src/components/html';
import type { Course } from '../../content/schema';
import { counted, courseSection } from './course-shared';

// Move to the YAML (hero.visualAlt) when T22 adds the hazard data.
const ALT = 'A concrete building site at dusk: an open trench, stacked cement bags, a ladder against the frame, an orange cable across the ground and a worker grinding steel';

type Fact = Course['hero']['facts'][number];

// The qualification line, from " in " on dimmed ("IOSH Level 3 Certificate <dim>in Occupational...</dim>").
function qualification(text: string) {
  const at = text.indexOf(' in ');
  return at < 0 ? esc(text) : `${esc(text.slice(0, at))} <span class="cbg-dim">${esc(text.slice(at + 1))}</span>`;
}

// A counted fact keeps its prefix ("About") outside the counted number; anything else is static.
function fact(f: Fact) {
  let value = esc(f.value);
  if (f.count !== undefined) {
    const prefix = f.prefix && f.value.startsWith(f.prefix) ? f.prefix : '';
    const num = f.value.slice(prefix.length).trim();
    value = `${prefix ? `<small>${esc(prefix)}</small> ` : ''}${counted(f.count, num)}`;
  }
  const text = f.count === undefined && f.value.length > 8; // long static facts set smaller (the Ofqual number)
  return `<li class="cbg-fact${text ? ' cbg-fact--text' : ''}"><b>${value}</b>${f.label ? `<span>${esc(f.label)}</span>` : ''}</li>`;
}

export const hero = ({ hero: h }: Course) => courseSection('hero', `
<p class="cbg-chip cbg-eyebrow">${esc(h.eyebrow)}</p>
<h2 class="cbg-title">${qualification(h.heading)}</h2>
<p class="cbg-lead">${esc(h.subhead)}</p>
<div class="cbg-btns"><a class="cbg-btn cbg-btn--primary cbg-btn--down" href="${esc(h.cta.href ?? '#course_content')}" data-cbg-action="${esc(h.cta.action ?? 'start-here')}">${esc(h.cta.label)}${arrow}</a></div>
<div class="cbg-hazard" data-cbg-hazard>
<div class="cbg-frame">${picture('hazard-worksite', {
  alt: ALT, eager: true, sizes: '(min-width: 1280px) 792px, (min-width: 1024px) 56vw, 100vw',
})}</div>
${h.hazards.length ? `<ol class="cbg-hazards" data-cbg-hazard-list>${h.hazards.map((z) => `<li>${esc(z.label)}</li>`).join('')}</ol>` : ''}
<div class="cbg-hazard-caption" aria-live="polite"></div>
</div>
<ul class="cbg-facts">${h.facts.map(fact).join('')}</ul>`);
