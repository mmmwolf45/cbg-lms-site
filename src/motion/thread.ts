import { gsap } from 'gsap';
import { all } from './reveal';

// Where each node sits along the thread, 0 (start) to 1 (end). `pos` are node centres along the
// thread's axis, measured from the element's edge. The thread starts at the first node's centre
// and stops the same distance short of the far edge (as .cbg-steps::before does: 20px insets, 40px nodes).
export function nodeFractions(pos: number[], size: number): number[] {
  const start = pos[0] ?? 0;
  const length = size - 2 * start;
  return pos.map((p) => (length > 0 ? Math.min(1, Math.max(0, (p - start) / length)) : 0));
}

// How many nodes the thread has reached at this progress (nothing before it starts to draw).
export const litCount = (progress: number, fractions: number[]) =>
  progress > 0 ? fractions.filter((f) => f <= progress + 1e-6).length : 0;

// [data-cbg-thread]: --cbg-thread scrubs 0 -> 1 with scroll (the CSS scales its line by it) and
// each .cbg-node gets is-lit once the line reaches it.
export function thread(roots: HTMLElement[]) {
  const unlight: (() => void)[] = [];
  for (const el of all(roots, '[data-cbg-thread]')) {
    const nodes = [...el.querySelectorAll<HTMLElement>('.cbg-node')];
    let fractions: number[] = [];
    let lit = -1;
    const light = (progress: number) => {
      const n = litCount(progress, fractions);
      if (n === lit) return;
      lit = n;
      nodes.forEach((node, i) => node.classList.toggle('is-lit', i < n));
    };
    // Layout is read only on refresh (load, resize, fonts, images), never per frame.
    const measure = () => {
      const box = el.getBoundingClientRect();
      const c = nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
      });
      const first = c[0] ?? [0, 0];
      const last = c[c.length - 1] ?? first;
      const across = Math.abs(last[0] - first[0]) > Math.abs(last[1] - first[1]);
      fractions = nodeFractions(c.map((p) => (across ? p[0] : p[1])), across ? box.width : box.height);
      lit = -1;
    };
    measure();
    const tween = gsap.fromTo(
      el,
      { '--cbg-thread': 0 },
      {
        '--cbg-thread': 1,
        ease: 'none',
        onUpdate() {
          light(this.progress());
        },
        scrollTrigger: {
          trigger: el,
          start: 'top 80%',
          end: 'bottom 55%',
          scrub: 0.4,
          // Runs during creation too, so it reads the tween through the trigger.
          onRefresh: (self) => {
            measure();
            light(self.animation?.progress() ?? 0);
          },
        },
      },
    );
    light(tween.progress());
    unlight.push(() => nodes.forEach((n) => n.classList.remove('is-lit')));
  }
  return () => unlight.forEach((f) => f());
}
