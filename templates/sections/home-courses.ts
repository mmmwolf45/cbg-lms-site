import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { PAGES, arrow, esc, picture, section } from '../../src/components/html';
import images from '../../src/images.json';
import type { Card, Home } from '../../content/schema';

type ImageName = keyof typeof images;

// The card's photo; until `npm run images` has built it, the media box shows its plain background (home.css).
const media = (c: Card) => (c.image && c.image in images
  ? picture(c.image as ImageName, { alt: '', sizes: '(min-width: 1024px) 400px, (min-width: 768px) 50vw, 86vw' })
  : '');

// The course's film in the story (SPEC section 5.1, src/motion/course-story.ts): square AVIF frames in
// public/course-films/<scene>/{l,s}/fNN.avif, scene = the card photo's name without "course-" (course-iosh ->
// iosh). The frame count comes from films.json (written with the films) or, failing that, from the files.
// A film counts only when both sets are complete; otherwise the chapter shows the card photo, still.
const FILMS = 'public/course-films';
const listed = (scene: string): number | undefined => {
  try {
    const e = JSON.parse(readFileSync(`${FILMS}/films.json`, 'utf8'))[scene];
    return Number(typeof e === 'object' ? e?.frames : e) || undefined;
  } catch {
    return undefined;
  }
};
const count = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => /^f\d+\.avif$/.test(f)).length : 0);
function film(c: Card): string {
  const scene = c.image?.replace(/^course-/, '') ?? '';
  const n = scene ? listed(scene) ?? count(`${FILMS}/${scene}/l`) : 0;
  if (!n || count(`${FILMS}/${scene}/l`) < n || count(`${FILMS}/${scene}/s`) < n) return '';
  return ` data-film="${PAGES}${FILMS.replace(/^public\//, '')}/${esc(scene)}/" data-frames="${n}"`;
}

// A live card is a link (its button stretches over the whole card); a coming-soon card is not. The link's
// name carries the course title for screen readers ("Open course: IOSH Level 3 Certificate").
function card(c: Card) {
  const cta = c.status === 'live now' ? c.cta : undefined;
  return `<li${film(c)}><article class="cbg-card cbg-course cbg-course--${cta ? 'live' : 'soon'}">
<div class="cbg-course__media" aria-hidden="true">${media(c)}</div>
<div class="cbg-course__body">
<p class="cbg-course__top">${c.tag ? `<span class="cbg-tag">${esc(c.tag)}</span> ` : ''}<span class="cbg-status">${esc(c.status)}</span></p>
<h3 class="cbg-h3">${esc(c.title)}</h3>
${c.line ? `<p>${esc(c.line)}</p>` : ''}
${c.meta?.length ? `<ul class="cbg-chips">${c.meta.map((m) => `<li class="cbg-chip">${esc(m)}</li>`).join('')}</ul>` : ''}
${cta ? `<a class="cbg-btn cbg-btn--primary cbg-course__link" href="${esc(cta.href)}">${esc(cta.label)}<span class="cbg-sr-only">: ${esc(c.title)}</span>${arrow}</a>` : ''}
</div></article></li>`;
}

// With full motion src/motion/course-story.ts turns the section into a story: it holds (sticky) for a screen
// of scroll per course, one card at a time beside its film on the decorative canvas in .cbg-story__stage.
// Otherwise (and as its fallback) the cards sit in one row (src/motion/gallery.ts pans it on a laptop; phones
// swipe it, home.css), so the row is a focusable, labelled region: keyboard users can scroll it with the arrow
// keys. A gold line runs under the cards (src/motion/gold-track.ts).
export const courses = ({ courses: s }: Home, cards: Card[]) => section('courses', `
<div class="cbg-section-head" data-cbg-reveal><h2 class="cbg-h2" id="cbg-courses-heading">${esc(s.heading)}</h2><p>${esc(s.intro)}</p></div>
<div class="cbg-gallery" role="region" aria-labelledby="cbg-courses-heading" tabindex="0">
<ul class="cbg-gallery__track" data-cbg-reveal="stagger">${cards.map(card).join('')}</ul>
</div>
<div class="cbg-story__stage" aria-hidden="true"><div class="cbg-story__film"><canvas class="cbg-story__canvas"></canvas></div></div>
<div class="cbg-gallery__bar" aria-hidden="true"><i></i></div>`, ' data-cbg-gallery data-cbg-story');
