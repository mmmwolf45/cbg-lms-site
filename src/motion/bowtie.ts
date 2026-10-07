import { gsap } from 'gsap';
import type { Enhancer } from './setup';
import { fullMotion } from './tokens';

// The 3D bow-tie (templates/sections/course-bowtie.ts, src/styles/bowtie.css). Its build-up is CSS, played
// by the scroll; this only leans it toward the mouse, slowly and by a few degrees (the side under the pointer
// dips away). Mouse and full motion only; touch never tilts. Rotation through quickTo on the wrapper, so it
// composes with the CSS transform on the stage inside it.
const DEG = { x: 3, y: 6 };

export const bowtieTilt: Enhancer = (roots) => {
  const fig = roots.map((r) => r.querySelector<HTMLElement>('[data-cbg-bowtie]')).find(Boolean);
  const tilt = fig?.querySelector<HTMLElement>('.cbg-bowtie__tilt');
  if (!fig || !tilt) return;
  const mm = gsap.matchMedia();
  mm.add(`${fullMotion} and (hover: hover) and (pointer: fine)`, () => {
    const rx = gsap.quickTo(tilt, 'rotationX', { duration: 1.4, ease: 'power3.out' });
    const ry = gsap.quickTo(tilt, 'rotationY', { duration: 1.4, ease: 'power3.out' });
    let box: DOMRect | undefined;
    const enter = () => (box = fig.getBoundingClientRect());
    const move = (e: PointerEvent) => {
      if (!box) return;
      rx((0.5 - (e.clientY - box.top) / box.height) * 2 * DEG.x);
      ry(((e.clientX - box.left) / box.width - 0.5) * 2 * DEG.y);
    };
    const leave = () => {
      box = undefined;
      rx(0);
      ry(0);
    };
    fig.addEventListener('pointerenter', enter);
    fig.addEventListener('pointermove', move);
    fig.addEventListener('pointerleave', leave);
    return () => {
      fig.removeEventListener('pointerenter', enter);
      fig.removeEventListener('pointermove', move);
      fig.removeEventListener('pointerleave', leave);
      gsap.set(tilt, { clearProps: 'transform' });
    };
  });
  return () => mm.revert();
};
