import { arrow, esc, picture, section } from '../../src/components/html';
import images from '../../src/images.json';
import type { Card, Home } from '../../content/schema';

type ImageName = keyof typeof images;

// The card's photo; until `npm run images` has built it, the media box shows its plain background (home.css).
const media = (c: Card) => (c.image && c.image in images
  ? picture(c.image as ImageName, { alt: '', sizes: '(min-width: 1024px) 400px, (min-width: 768px) 50vw, 86vw' })
  : '');

// A live card is a link (its button stretches over the whole card); a coming-soon card is not. The link's
// name carries the course title for screen readers ("Open course: IOSH Level 3 Certificate").
function card(c: Card) {
  const cta = c.status === 'live now' ? c.cta : undefined;
  return `<li><article class="cbg-card cbg-course cbg-course--${cta ? 'live' : 'soon'}">
<div class="cbg-course__media" aria-hidden="true">${media(c)}</div>
<div class="cbg-course__body">
<p class="cbg-course__top">${c.tag ? `<span class="cbg-tag">${esc(c.tag)}</span> ` : ''}<span class="cbg-status">${esc(c.status)}</span></p>
<h3 class="cbg-h3">${esc(c.title)}</h3>
${c.line ? `<p>${esc(c.line)}</p>` : ''}
${c.meta?.length ? `<ul class="cbg-chips">${c.meta.map((m) => `<li class="cbg-chip">${esc(m)}</li>`).join('')}</ul>` : ''}
${cta ? `<a class="cbg-btn cbg-btn--primary cbg-course__link" href="${esc(cta.href)}">${esc(cta.label)}<span class="cbg-sr-only">: ${esc(c.title)}</span>${arrow}</a>` : ''}
</div></article></li>`;
}

// The cards sit in one row (src/motion/gallery.ts pans it on a laptop; phones swipe it, home.css), so the
// row is a focusable, labelled region: keyboard users can scroll it with the arrow keys.
export const courses = ({ courses: s }: Home, cards: Card[]) => section('courses', `
<div class="cbg-section-head" data-cbg-reveal><h2 class="cbg-h2" id="cbg-courses-heading">${esc(s.heading)}</h2><p>${esc(s.intro)}</p></div>
<div class="cbg-gallery" role="region" aria-labelledby="cbg-courses-heading" tabindex="0">
<ul class="cbg-gallery__track" data-cbg-reveal="stagger">${cards.map(card).join('')}</ul>
</div>
<div class="cbg-gallery__bar" aria-hidden="true"><i></i></div>`, ' data-cbg-gallery');
