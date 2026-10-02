import { picture, section } from '../../src/components/html';
import images from '../../src/images.json';
import type { Home } from '../../content/schema';

type ImageName = keyof typeof images;

// A full-width decorative photo with a gentle scroll parallax (src/motion/parallax.ts). Left out until
// `npm run images` has built its image.
export function band({ band: b }: Home) {
  if (!b || !(b.image in images)) return '';
  return section('band', `<div class="cbg-band__view">${picture(b.image as ImageName, {
    cls: 'cbg-band__media', alt: '', sizes: '100vw',
  })}</div>`, ' data-cbg-parallax');
}
