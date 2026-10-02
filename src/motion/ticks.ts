import { gsap } from 'gsap';
import { all, DONE, enterAt } from './reveal';
import type { Enhancer } from './setup';
import { fullMotion } from './tokens';

// [data-cbg-ticks]: when the list enters the viewport (once), each item's .cbg-tick path draws
// (pathLength 1, so stroke-dashoffset 1 → 0) one after another, and its text brightens from 60%.
// Full motion only: under reduced motion motion.css never hides anything, so the ticks are drawn.
// A finished list is marked done and left alone by any later setup.
export const ticks: Enhancer = (roots) => {
  const lists = all(roots, '[data-cbg-ticks]').filter((el) => !el.classList.contains(DONE));
  if (!lists.length) return;
  const mm = gsap.matchMedia();
  mm.add(fullMotion, () => {
    for (const list of lists) {
      const items = [...list.children].filter((li) => li.querySelector('.cbg-tick path'));
      if (!items.length) {
        list.classList.add(DONE);
        continue;
      }
      const paths = items.map((li) => li.querySelector('.cbg-tick path'));
      const texts = items.map((li) => li.querySelector(':scope > :not(.cbg-tick)'));
      // Inline styles are cleared only once the list is done: until then CSS holds the hidden state.
      const tl = gsap.timeline({
        scrollTrigger: { trigger: list, start: enterAt(list), once: true },
        defaults: { duration: 0.5, ease: 'power2.out' },
        onComplete: () => {
          list.classList.add(DONE);
          gsap.set([...paths, ...texts].filter(Boolean), { clearProps: 'strokeDashoffset,opacity' });
        },
      });
      items.forEach((_, i) => {
        const at = i * 0.09;
        tl.fromTo(paths[i], { strokeDashoffset: 1 }, { strokeDashoffset: 0 }, at);
        if (texts[i]) tl.fromTo(texts[i], { opacity: 0.6 }, { opacity: 1 }, at);
      });
    }
  });
  return () => mm.revert();
};
