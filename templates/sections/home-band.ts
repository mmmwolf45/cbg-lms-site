import { PAGES, esc, picture } from '../../src/components/html';
import { FRAMES, OUT } from '../../scripts/orbit-frames';
import type { Home } from '../../content/schema';

// The band (SPEC section 5.1.2): a night construction site that turns about 60 degrees with the scroll.
// The tall .cbg-orbit gives the sticky stage 0.9 of a screen of scrolling (only while the script runs; see
// site-orbit.css); src/motion/site-orbit.ts plays the frames scripts/orbit-frames.ts cut on the canvas.
// The poster (frame 1) is the no-JS and reduced-motion view. One labelled picture to screen readers.
export function band({ band: b }: Home) {
  if (!b) return '';
  return `<section id="cbg-band" class="cbg-section cbg-band" data-cbg-section="band" data-cbg-orbit="${PAGES}${OUT.replace(/^public\//, '')}/" data-cbg-frames="${FRAMES}"><div class="cbg-wrap">`
    + `<div class="cbg-orbit"><div class="cbg-orbit__stage" role="img" aria-label="${esc(b.alt)}"><div class="cbg-orbit__film">`
    + picture('site-orbit-poster', { cls: 'cbg-orbit__poster', alt: '', sizes: '100vw' })
    + '<canvas class="cbg-orbit__canvas" aria-hidden="true"></canvas>'
    + '</div></div></div></div></section>';
}
