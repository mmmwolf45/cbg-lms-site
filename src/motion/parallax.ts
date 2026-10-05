import { gsap } from 'gsap';
import { all } from './reveal';
import type { Enhancer } from './setup';
import { fullMotion } from './tokens';

// [data-cbg-parallax] (the home photo band): its photo, 20% taller than the band (home.css), drifts
// against the scroll while the band crosses the screen. Full motion only; otherwise it stays centred.
export const parallax: Enhancer = (roots) => {
  const bands = all(roots, '[data-cbg-parallax]');
  if (!bands.length) return;
  const mm = gsap.matchMedia();
  mm.add(fullMotion, () => {
    for (const band of bands) {
      const media = band.querySelector('.cbg-band__media');
      if (!media) continue;
      gsap.fromTo(media, { yPercent: -7 }, {
        yPercent: 7,
        ease: 'none',
        scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    }
  });
  return () => mm.revert();
};
