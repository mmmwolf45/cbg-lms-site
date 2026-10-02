import { arrow, esc, picture } from '../../src/components/html';
import images from '../../src/images.json';
import type { Course, Section } from '../../content/schema';
import { counted, courseSection } from './course-shared';

type Hero = Section<'hero'>;
type Fact = Hero['facts'][number];
type Hazard = NonNullable<Hero['hazards']>[number];
type ImageName = keyof typeof images;

export const pct = (v: number, of: number) => +((v / of) * 100).toFixed(2);

// The hero image (hero.image, checked against src/images.json by the schema), eager: it is above the fold.
const photo = (h: Hero) => picture(h.image as ImageName, {
  alt: h.imageAlt ?? '', eager: true, sizes: '(min-width: 1280px) 792px, (min-width: 1024px) 56vw, 100vw',
});

// Hazard Scan (T22, src/motion/hazard-scan.ts). The 3:2 photo shows uncropped in a 3:2 box, so a point in
// % of the photo is the same % of the box at every width. Markers, tip and tour controls carry
// `hidden` (works with no CSS at all) until the script shows them; without it, the photo and the list.
function hazardScan(h: Hero, hazards: Hazard[], tour: NonNullable<Hero['tour']>) {
  const { width: PW, height: PH } = images[h.image as ImageName];
  const dot = ({ label, at: [x, y], zoom: [zx, zy, zw, zh] }: Hazard, i: number) =>
    `<button type="button" class="cbg-hazard-dot${x > PW * 0.6 ? ' cbg-hazard-dot--l' : ''}" data-cbg-hazard-i="${i + 1}"`
    + ` data-cbg-zoom="${pct(zx, PW)} ${pct(zy, PH)} ${pct(zw, PW)} ${pct(zh, PH)}" aria-describedby="cbg-hazard-${i + 1}"`
    + ` style="--x:${pct(x, PW)}%;--y:${pct(y, PH)}%" hidden><span>${esc(label)}</span></button>`;
  const step = (by: number, label: string) => `<button type="button" class="cbg-hazard-btn" data-cbg-hazard-step="${by}">${esc(label)}</button>`;
  // aria-live="off" until the student first presses a tour control (hazard-scan.ts), so the tour's
  // automatic first step is never spoken unprompted.
  return `<div class="cbg-hazard" data-cbg-hazard><div class="cbg-frame"><div class="cbg-hazard__view"><div class="cbg-hazard__stage">${photo(h)}`
    + `<i class="cbg-hazard__scan"></i>${hazards.map(dot).join('')}</div></div>`
    + '<p class="cbg-hazard-tip" aria-hidden="true" hidden></p></div>'
    + '<div class="cbg-hazard-caption" aria-live="off"></div>'
    + `<div class="cbg-hazard-tour" hidden>${step(-1, tour.previous)}<span class="cbg-hazard-count"></span>${step(1, tour.next)}</div>`
    + `<ol class="cbg-hazards" data-cbg-hazard-list>${hazards.map((z, i) =>
      `<li id="cbg-hazard-${i + 1}"><strong>${esc(z.label)}</strong> <span>${esc(z.detail)}</span></li>`).join('')}</ol></div>`;
}

// hero.visual: the Hazard Scan, a plain photo in the same 3:2 frame (no motion hook), or nothing.
function visual(h: Hero) {
  if (h.visual === 'hazard-scan' && h.hazards && h.tour) return hazardScan(h, h.hazards, h.tour);
  if (h.visual === 'photo') return `<div class="cbg-hazard"><div class="cbg-frame">${photo(h)}</div></div>`;
  return '';
}

// The heading from " in " on dimmed ("IOSH Level 3 Certificate <dim>in Occupational...</dim>").
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
  const text = f.count === undefined && f.value.length > 8; // long static facts set smaller (e.g. an Ofqual number)
  return `<li class="cbg-fact${text ? ' cbg-fact--text' : ''}"><b>${value}</b>${f.label ? `<span>${esc(f.label)}</span>` : ''}</li>`;
}

export const hero = ({ hero: h }: Course) => courseSection('hero', `
<p class="cbg-chip cbg-eyebrow">${esc(h.eyebrow)}</p>
<h2 class="cbg-title">${qualification(h.heading)}</h2>
<p class="cbg-lead">${esc(h.subhead)}</p>
<div class="cbg-btns"><a class="cbg-btn cbg-btn--primary cbg-btn--down" href="${esc(h.cta.href ?? '#course_content')}" data-cbg-action="${esc(h.cta.action ?? 'start-here')}">${esc(h.cta.label)}${arrow}</a></div>
${visual(h)}
<ul class="cbg-facts">${h.facts.map(fact).join('')}</ul>`);
