import { gsap } from 'gsap';
import { whenSeen } from './seen';
import { dur, ease, stagger } from './tokens';

// Marks an element whose one-off motion has finished. motion.css never hides a done element,
// so a later setup (route change, React re-render of a sibling) leaves it alone.
export const DONE = 'cbg-done';

export const all = (roots: HTMLElement[], sel: string) => roots.flatMap((r) => [...r.querySelectorAll<HTMLElement>(sel)]);

// Marks el done, then drops the tween's inline styles, in that order. A tween's own clearProps would
// run per target as each one lands, and a stagger child cleared before its parent is done falls back to
// motion.css's hidden state until the last sibling lands: the flash seen on phones (3 Oct 2026).
export const finish = (el: Element, targets: Element[], props: string) => () => {
  el.classList.add(DONE);
  gsap.set(targets, { clearProps: props });
};

// [data-cbg-reveal] rises 16px and fades in once; [data-cbg-reveal="stagger"] does that to its children in turn.
// Returns the cancel for the waits; the tweens belong to the caller's gsap context.
export function reveal(roots: HTMLElement[]): () => void {
  const cancels: (() => void)[] = [];
  for (const el of all(roots, '[data-cbg-reveal]')) {
    if (el.classList.contains(DONE)) continue;
    const targets = el.dataset.cbgReveal === 'stagger' ? [...el.children] : [el];
    if (!targets.length) continue;
    const tween = gsap.fromTo(
      targets,
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: dur.base,
        ease: ease.out,
        stagger,
        paused: true,
        onComplete: finish(el, targets, 'opacity,transform'),
      },
    );
    cancels.push(whenSeen(el, () => void tween.play()));
  }
  return () => cancels.forEach((f) => f());
}
