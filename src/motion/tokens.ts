// Mirrors the motion tokens in src/styles/tokens.css (GSAP can't read CSS custom properties).
// Durations in seconds, as GSAP expects.
export const dur = { base: 0.6, slow: 1.2 } as const;

export const ease = {
  out: 'expo.out', // GSAP's closest named ease to --cbg-ease, cubic-bezier(0.22, 1, 0.36, 1)
} as const;

export const stagger = 0.07;

// Canvas redraw caps (ms between draws). On the Intel UHD laptop (Chrome, D3D11, a 165 Hz panel; 6 Oct 2026,
// lab/scroll-perf.mjs in a real window) every canvas redraw costs the GPU a fixed slice whatever its size: the
// flow waves at a tenth of the screen cost as much as at a third, and redrawn on each of 165 frames a second
// they alone took scroll frames from 6 to 24-36 ms. So the hero film redraw at most 60
// times a second and the page background (waves, sky) at most 30; a 60 Hz screen loses nothing
// to the first cap (the 2 ms slack keeps rAF jitter from halving it).
export const FILM_MS = 14.7; // 1000 / 60 - 2
export const BACKDROP_MS = 31.3; // 1000 / 30 - 2
// Whether a loop that last drew at `last` (rAF ms) may draw again at `now`.
export const due = (now: number, last: number, ms: number) => now - last >= ms;

export const reducedMotion = '(prefers-reduced-motion: reduce)';
export const fullMotion = '(prefers-reduced-motion: no-preference)';

// Helpers for the scroll-played footage heroes (home: explode.ts, course: scrub.ts). Here, in the entry
// chunk, so neither page loads an extra chunk (or the other page's hero) for them.
export const smooth = (x: number) => x * x * (3 - 2 * x);
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// Scroll progress through the pinned stretch: 0 when the section's top reaches the stage's sticky top,
// 1 when the stage is about to be released.
export const progress = (top: number, stickyTop: number, span: number) => clamp01((stickyTop - top) / Math.max(1, span));

// Phones (and small windows) get the small frames, larger screens the large ones. The pixel ratio counts up
// to 2 only: a 3x phone took the large set, twice the memory, for detail a phone can't show (6 Oct 2026).
export const frameDir = (w: number, h: number, dpr: number) => (Math.min(w, h) * Math.min(dpr, 2) < 1100 ? 's' : 'l');

// Frame 0 first, then every 8th, 4th, 2nd, then the rest: a coarse pass the scroll can already use.
export function loadOrder(n: number): number[] {
  const order: number[] = [];
  for (const step of [8, 4, 2, 1]) for (let i = 0; i < n; i += step) if (!order.includes(i)) order.push(i);
  return order;
}
