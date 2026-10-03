import { gsap } from 'gsap';
import { DONE, all } from './reveal';
import { whenSeen } from './seen';
import { dur } from './tokens';

// The text shown for a running value: whole numbers, grouped like the final text ("1,200"),
// and exactly the final text once the target is reached.
export function countText(value: number, target: number, final: string): string {
  if (value >= target) return final;
  const n = Math.max(0, Math.floor(value));
  return final.includes(',') ? n.toLocaleString('en-US') : String(n);
}

// [data-cbg-count="N"] counts 0 -> N once in view. The counted element is aria-hidden: screen readers read
// the .cbg-sr-only copy of the final value beside it (docs/markup-contract.md), never the running number.
// Returns a cleanup that puts the final text back (used when the page or the motion preference changes).
export function counters(roots: HTMLElement[]) {
  const restore: (() => void)[] = [];
  for (const el of all(roots, '[data-cbg-count]')) {
    const target = Number(el.dataset.cbgCount);
    const final = el.textContent ?? '';
    if (el.classList.contains(DONE) || !(target > 0) || !final.trim()) continue;
    // One text node, updated through .data: a characterData change, which the DOM watchers ignore.
    const text = document.createTextNode(countText(0, target, final));
    el.replaceChildren(text);
    restore.push(() => (text.data = final));
    const state = { v: 0 };
    const tween = gsap.to(state, {
      v: target,
      duration: dur.slow,
      ease: 'power2.out',
      paused: true,
      onUpdate: () => {
        const next = countText(state.v, target, final);
        if (next !== text.data) text.data = next;
      },
      onComplete: () => el.classList.add(DONE),
    });
    // Counting starts the moment the number appears at the bottom of the screen: a 0 must never sit in view.
    restore.push(whenSeen(el, () => void tween.play(), 1));
  }
  return () => restore.forEach((f) => f());
}
