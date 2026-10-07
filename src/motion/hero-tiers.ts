import { gsap } from 'gsap';
import { DONE } from './reveal';
import { whenSeen } from './seen';
import { reducedMotion } from './tokens';

// Hierarchy of control (hero.visual: hierarchy; templates/sections/course-hero-options.ts,
// hero-options.css). The tiers fill in from the most effective down, each bar widening into place with
// its example beside it, while the "most to least effective" line draws down alongside.

export function enhance(fig: HTMLElement): () => void {
  if (matchMedia(reducedMotion).matches || fig.classList.contains(DONE)) return () => {};
  const bars = [...fig.querySelectorAll<HTMLElement>('.cbg-tier__bar')];
  const examples = [...fig.querySelectorAll<HTMLElement>('.cbg-tier__ex')];
  const line = fig.querySelector<HTMLElement>('.cbg-tiers__scale i')!;
  const STEP = 0.5;

  const ctx = gsap.context(() => {});
  const play = () => ctx.add(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        fig.classList.add(DONE);
        gsap.set([...bars, ...examples, line], { clearProps: 'opacity,transform' });
      },
    });
    tl.fromTo(line, { scaleY: 0 }, { scaleY: 1, duration: STEP * bars.length + 0.6, ease: 'sine.inOut' }, 0);
    bars.forEach((b, i) => {
      tl.fromTo(b, { opacity: 0, scaleX: 0.84 }, { opacity: 1, scaleX: 1, duration: 1.1, ease: 'power2.out' }, i * STEP)
        .fromTo(examples[i], { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.9, ease: 'power2.out' }, i * STEP + 0.35);
    });
  });
  const cancel = whenSeen(fig, play, 0.8);
  return () => {
    cancel();
    ctx.revert();
  };
}
