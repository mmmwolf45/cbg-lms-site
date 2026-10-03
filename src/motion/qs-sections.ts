import { gsap } from 'gsap';
import { all } from './reveal';
import type { Enhancer } from './setup';
import { fullMotion } from './tokens';

// The placement wall (templates/sections/course-placements.ts). With motion, the pills are copied into
// rows (person 1 in row 1, person 2 in row 2...) that drift in opposite directions while the wall crosses
// the screen: scroll is the only clock, transforms only. The copies are aria-hidden; the real list stays
// for screen readers (qs.css hides it visually). The certificate sheets are CSS only (qs.css).

// The quotes row (templates/sections/course-testimonials.ts) is a tab stop only while it scrolls: from a
// 540px column it is a grid (a container query, so no matchMedia), and a tab stop there holds nothing.
function quotesStop(row: HTMLElement) {
  const ro = new ResizeObserver(() => (row.tabIndex = row.scrollWidth > row.clientWidth ? 0 : -1));
  ro.observe(row);
  return () => ro.disconnect();
}

// How far a row drifts: half the scroll it takes the wall to cross the screen (slow enough to read),
// never more than its overflow, so a row never shows empty space at its end.
export const travel = (overflow: number, distance: number) => Math.max(0, Math.min(overflow, distance / 2));

function drift(wall: HTMLElement, n: number) {
  const pills = [...wall.querySelectorAll<HTMLElement>('.cbg-wall__list > li')];
  const box = document.createElement('div');
  box.className = 'cbg-wall__rows';
  box.setAttribute('aria-hidden', 'true');
  const rows = Array.from({ length: n }, () => box.appendChild(document.createElement('div')));
  rows.forEach((r) => (r.className = 'cbg-wall__row'));
  pills.forEach((p, i) => rows[i % n]!.appendChild(p.cloneNode(true)));
  wall.append(box);
  const far = (row: HTMLElement) => travel(row.scrollWidth - box.clientWidth, innerHeight + box.offsetHeight);
  rows.forEach((row, i) => {
    const [from, to] = i % 2 ? [(r: HTMLElement) => -far(r), () => 0] : [() => 0, (r: HTMLElement) => -far(r)];
    gsap.fromTo(row, { x: () => from(row) }, {
      x: () => to(row), ease: 'none',
      scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true },
    });
  });
  return () => box.remove();
}

export const qsSections: Enhancer = (roots) => {
  const stops = all(roots, '.cbg-quotes').map(quotesStop);
  const mm = gsap.matchMedia();
  // matchMedia reverts the tweens and triggers; the returned cleanup removes the copies, so a re-run
  // (route change, React re-render) or a switch to reduced motion starts from the plain list again.
  mm.add(fullMotion, () => {
    const undo = all(roots, '[data-cbg-wall]').map((w) => drift(w, Number(w.dataset.cbgWall) || 2));
    return () => undo.forEach((f) => f());
  });
  return () => {
    mm.revert();
    stops.forEach((f) => f());
  };
};
