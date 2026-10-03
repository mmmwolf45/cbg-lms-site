// Mirrors the motion tokens in src/styles/tokens.css (GSAP can't read CSS custom properties).
// Durations in seconds, as GSAP expects.
export const dur = { base: 0.6, slow: 1.2 } as const;

export const ease = {
  out: 'expo.out', // GSAP's closest named ease to --cbg-ease, cubic-bezier(0.22, 1, 0.36, 1)
} as const;

export const stagger = 0.07;

export const reducedMotion = '(prefers-reduced-motion: reduce)';
export const fullMotion = '(prefers-reduced-motion: no-preference)';

// Helpers for the scroll-played footage heroes (home: explode.ts, course: scrub.ts). Here, in the entry
// chunk, so neither page loads an extra chunk (or the other page's hero) for them.
export const smooth = (x: number) => x * x * (3 - 2 * x);
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// Scroll progress through the pinned stretch: 0 when the section's top reaches the stage's sticky top,
// 1 when the stage is about to be released.
export const progress = (top: number, stickyTop: number, span: number) => clamp01((stickyTop - top) / Math.max(1, span));

// Phones (and small windows) get the small frames, larger screens the large ones.
export const frameDir = (w: number, h: number, dpr: number) => (Math.min(w, h) * dpr < 1100 ? 's' : 'l');

// Frame 0 first, then every 8th, 4th, 2nd, then the rest: a coarse pass the scroll can already use.
export function loadOrder(n: number): number[] {
  const order: number[] = [];
  for (const step of [8, 4, 2, 1]) for (let i = 0; i < n; i += step) if (!order.includes(i)) order.push(i);
  return order;
}
