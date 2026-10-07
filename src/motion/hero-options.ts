import { failOpen, type Enhancer } from './setup';

// The hero options beyond the Hazard Scan (templates/sections/course-hero-options.ts). A page shows at most
// one, so each has its own chunk (cbg-hero-*.js), fetched only when its block is on the page: no other page
// pays for it (scripts/check-size.ts counts the largest one against the course budget).
type Mod = { enhance: (el: HTMLElement) => () => void };
const OPTIONS: [string, () => Promise<Mod>][] = [
  ['[data-cbg-safe]', () => import('./hero-safe')],
  ['[data-cbg-matrix]', () => import('./hero-matrix')],
  ['[data-cbg-tiers]', () => import('./hero-tiers')],
  ['[data-cbg-cheese]', () => import('./hero-cheese')],
];

export const heroOptions: Enhancer = (roots) => {
  for (const [sel, load] of OPTIONS) {
    const el = roots.map((r) => r.querySelector<HTMLElement>(sel)).find(Boolean);
    if (!el) continue;
    let undo: (() => void) | undefined;
    let dead = false;
    load()
      .then((m) => {
        if (!dead) undo = m.enhance(el);
      })
      .catch((err) => dead || failOpen(err));
    return () => {
      dead = true;
      undo?.();
    };
  }
};
