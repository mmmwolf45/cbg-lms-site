import type { Enhancer } from './setup';

interface Trigger {
  textContent: string | null;
  getAttribute(name: string): string | null;
}
interface Root<T extends Trigger> {
  querySelectorAll(sel: string): Iterable<T>;
}

// Course Content's section toggles are Radix accordion triggers: buttons carrying aria-expanded.
// Prefer the one titled "Start Here"; otherwise the first. Never by Radix id.
export function findStartTrigger<T extends Trigger>(content: Root<T>): T | undefined {
  const triggers = [...content.querySelectorAll('button[aria-expanded]')];
  return triggers.find((t) => /^\s*\d*\s*Start Here/i.test(t.textContent ?? '')) ?? triggers[0];
}

const NAVBAR = 72; // course.link's sticky navbar (3.5rem) plus a little air

// T21: [data-cbg-action="start-here"] scrolls to Course Content and opens its first item (Start Here).
// Without JS it is a plain #course_content link.
export const startHere: Enhancer = (roots) => {
  const off = new AbortController();
  const links = roots.flatMap((r) => [...r.querySelectorAll<HTMLAnchorElement>('[data-cbg-action="start-here"]')]);
  for (const link of links) {
    link.addEventListener(
      'click',
      (e) => {
        const content = link.ownerDocument.getElementById('course_content');
        if (!content) return;
        e.preventDefault();
        const trigger = findStartTrigger(content);
        if (trigger instanceof HTMLElement && trigger.getAttribute('aria-expanded') !== 'true') trigger.click();
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const top = content.getBoundingClientRect().top + scrollY - NAVBAR;
        scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
        if (trigger instanceof HTMLElement) trigger.focus({ preventScroll: true });
      },
      { signal: off.signal },
    );
  }
  return () => off.abort();
};

// course.link opens the first Course Content section on every load. The page starts with all of them
// closed: close that default once per rendered list (a re-setup or the reader's own choices later are
// left alone). Only the untouched default: exactly one open, and it is the first.
const settled = new WeakSet<Element>();
export const closeDefaultSection: Enhancer = () => {
  const content = document.getElementById('course_content');
  if (!content || settled.has(content)) return;
  settled.add(content);
  const triggers = [...content.querySelectorAll<HTMLElement>('button[aria-expanded]')];
  const open = triggers.filter((t) => t.getAttribute('aria-expanded') === 'true');
  if (open.length === 1 && open[0] === triggers[0]) open[0].click();
};
