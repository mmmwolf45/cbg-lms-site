import { esc } from '../../src/components/html';
import type { Home } from '../../content/schema';

// The band: the host for the 3D night construction site (src/motion/three-sections.ts mounts the shared
// canvas into [data-cbg-site3d]). One labelled picture to screen readers; empty in the block itself.
// The floating desk it used to hold was removed on 6 Oct 2026.
export function band({ band: b }: Home) {
  if (!b) return '';
  return `<section id="cbg-band" class="cbg-section cbg-band" data-cbg-section="band"><div class="cbg-wrap">`
    + `<div class="cbg-band__view" data-cbg-site3d role="img" aria-label="${esc(b.alt)}"></div>`
    + '</div></section>';
}
