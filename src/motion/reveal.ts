import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { dur, ease, stagger } from './tokens';

// Marks an element whose one-off motion has finished. motion.css never hides a done element,
// so a later setup (route change, React re-render of a sibling) leaves it alone.
export const DONE = 'cbg-done';

export const all = (roots: HTMLElement[], sel: string) => roots.flatMap((r) => [...r.querySelectorAll<HTMLElement>(sel)]);

// 'top 88%', but never past the end of the page, so content near the bottom still reveals.
// ('clamp(top 88%)' would also clamp to 0, and then content already in view never "enters".)
export const enterAt = (el: HTMLElement) => () =>
  Math.min(
    el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.88,
    ScrollTrigger.maxScroll(window) - 1,
  );

// [data-cbg-reveal] rises 16px and fades in once; [data-cbg-reveal="stagger"] does that to its children in turn.
export function reveal(roots: HTMLElement[]) {
  for (const el of all(roots, '[data-cbg-reveal]')) {
    if (el.classList.contains(DONE)) continue;
    const targets = el.dataset.cbgReveal === 'stagger' ? [...el.children] : [el];
    if (!targets.length) continue;
    gsap.fromTo(
      targets,
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: dur.base,
        ease: ease.out,
        stagger,
        clearProps: 'opacity,transform',
        onComplete: () => el.classList.add(DONE),
        scrollTrigger: { trigger: el, start: enterAt(el), once: true },
      },
    );
  }
}
