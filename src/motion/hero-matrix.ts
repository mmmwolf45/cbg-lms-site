import { gsap } from 'gsap';
import { DONE } from './reveal';
import { whenSeen } from './seen';
import { reducedMotion } from './tokens';

// Risk matrix (hero.visual: risk-matrix; templates/sections/course-hero-options.ts, hero-options.css). Each
// risk settles into its cell before controls, one after another; then, in turn, each glides slowly to its
// cell after controls, leaving a dashed ring where it was. The markup holds the finished state (the
// markers at their `to` cells, the rings at `from`), so the markers start offset by from - to.

export function enhance(fig: HTMLElement): () => void {
  if (matchMedia(reducedMotion).matches || fig.classList.contains(DONE)) return () => {};
  const grid = fig.querySelector<HTMLElement>('.cbg-matrix__grid')!;
  const risks = [...grid.querySelectorAll<HTMLElement>('.cbg-risk:not(.cbg-risk--was)')];
  const rings = [...grid.querySelectorAll<HTMLElement>('.cbg-risk--was')];
  // From the finished place back to the before cell, in px of the grid now.
  const back = (el: HTMLElement, axis: 0 | 1) => () => {
    const from = Number(el.dataset.cbgFrom!.split(' ')[axis]);
    const to = parseFloat(el.style.getPropertyValue(axis ? '--y' : '--x'));
    return ((from - to) / 100) * (axis ? grid.offsetHeight : grid.offsetWidth);
  };

  const ctx = gsap.context(() => {});
  const play = () => ctx.add(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        fig.classList.add(DONE);
        gsap.set([...risks, ...rings], { clearProps: 'opacity,transform' });
      },
    });
    risks.forEach((r, i) => tl.fromTo(r, { opacity: 0, scale: 0.6, x: back(r, 0), y: back(r, 1) },
      { opacity: 1, scale: 1, duration: 0.9, ease: 'power2.out' }, i * 0.22));
    tl.addLabel('move', '+=0.9');
    risks.forEach((r, i) => {
      tl.to(r, { x: 0, y: 0, duration: 1.8, ease: 'power2.inOut' }, `move+=${i * 0.45}`)
        .fromTo(rings[i], { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'sine.out' }, `move+=${i * 0.45 + 0.3}`);
    });
  });
  const cancel = whenSeen(grid, play, 0.8);
  return () => {
    cancel();
    ctx.revert();
  };
}
