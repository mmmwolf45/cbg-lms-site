import { gsap } from 'gsap';
import { all } from './reveal';
import type { Enhancer } from './setup';
import { fullMotion } from './tokens';

export const MAX_DEG = 4;

// The tilt for a pointer at (x, y) in a w x h card: the side under the pointer dips away, at most MAX_DEG.
export function tiltFor(x: number, y: number, w: number, h: number): [rotationX: number, rotationY: number] {
  const clamp = gsap.utils.clamp(-MAX_DEG, MAX_DEG);
  return [clamp((0.5 - y / h) * 2 * MAX_DEG), clamp((x / w - 0.5) * 2 * MAX_DEG)];
}

// Live course cards (links) lean toward the mouse; coming-soon cards are not links, so they stay still (the
// photo zoom, gold edge and rule are CSS: motion.css). Mouse only (touch never tilts), full motion only.
// Rotation only, through quickTo; the card's box is read once per hover, not per move.
export const cardTilt: Enhancer = (roots) => {
  const cards = all(roots, '.cbg-course--live');
  if (!cards.length) return;
  const mm = gsap.matchMedia();
  mm.add(`${fullMotion} and (hover: hover) and (pointer: fine)`, () => {
    const off = new AbortController();
    const signal = off.signal;
    for (const card of cards) {
      gsap.set(card, { transformPerspective: 900 });
      const toX = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
      const toY = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });
      let box: DOMRect | undefined;
      card.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        box ??= card.getBoundingClientRect();
        const [x, y] = tiltFor(e.clientX - box.left, e.clientY - box.top, box.width, box.height);
        toX(x);
        toY(y);
      }, { signal });
      card.addEventListener('pointerleave', () => {
        box = undefined;
        toX(0);
        toY(0);
      }, { signal });
    }
    return () => off.abort();
  });
  return () => mm.revert();
};
