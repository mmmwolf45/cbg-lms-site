import { arrow, esc, picture } from '../../src/components/html';
import { HAZARD_PHOTO, type Course } from '../../content/schema';
import { counted, courseSection } from './course-shared';

// Move to the YAML (hero.visualAlt) when T22 adds the hazard data.
const ALT = 'A concrete building site at dusk: an open trench, stacked cement bags, a ladder against the frame, an orange cable across the ground and a worker grinding steel';

type Fact = Course['hero']['facts'][number];
type Hazard = Course['hero']['hazards'][number];

// Hazard Scan (T22, src/motion/hazard-scan.ts). The photo shows uncropped in a 3:2 box, so a point in
// % of the photo is the same % of the box at every width. Markers, tip and tour controls carry
// `hidden` (works with no CSS at all) until the script shows them; without it, the photo and the list.
const [PW, PH] = HAZARD_PHOTO;
export const pct = (v: number, of: number) => +((v / of) * 100).toFixed(2);

const dot = ({ label, at: [x, y], zoom: [zx, zy, zw, zh] }: Hazard, i: number) =>
  `<button type="button" class="cbg-hazard-dot${x > PW * 0.6 ? ' cbg-hazard-dot--l' : ''}" data-cbg-hazard-i="${i + 1}"`
  + ` data-cbg-zoom="${pct(zx, PW)} ${pct(zy, PH)} ${pct(zw, PW)} ${pct(zh, PH)}" aria-describedby="cbg-hazard-${i + 1}"`
  + ` style="--x:${pct(x, PW)}%;--y:${pct(y, PH)}%" hidden><span>${esc(label)}</span></button>`;

function hazardScan(hazards: Hazard[]) {
  const photo = picture('hazard-worksite', {
    alt: ALT, eager: true, sizes: '(min-width: 1280px) 792px, (min-width: 1024px) 56vw, 100vw',
  });
  const caption = '<div class="cbg-hazard-caption" aria-live="polite"></div>';
  if (!hazards.length) return `<div class="cbg-frame">${photo}</div>${caption}`;
  const step = (by: number, label: string) => `<button type="button" class="cbg-hazard-btn" data-cbg-hazard-step="${by}">${label}</button>`;
  return `<div class="cbg-frame"><div class="cbg-hazard__view"><div class="cbg-hazard__stage">${photo}`
    + `<i class="cbg-hazard__scan"></i>${hazards.map(dot).join('')}</div></div>`
    + '<p class="cbg-hazard-tip" aria-hidden="true" hidden></p></div>'
    + caption
    + `<div class="cbg-hazard-tour" hidden>${step(-1, 'Previous')}<span class="cbg-hazard-count"></span>${step(1, 'Next')}</div>`
    + `<ol class="cbg-hazards" data-cbg-hazard-list>${hazards.map((z, i) =>
      `<li id="cbg-hazard-${i + 1}"><strong>${esc(z.label)}</strong> <span>${esc(z.detail)}</span></li>`).join('')}</ol>`;
}

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
<div class="cbg-hazard" data-cbg-hazard>${hazardScan(h.hazards)}</div>
<ul class="cbg-facts">${h.facts.map(fact).join('')}</ul>`);
