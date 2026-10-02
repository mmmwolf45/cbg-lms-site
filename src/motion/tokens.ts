// Mirrors the motion tokens in src/styles/tokens.css (GSAP can't read CSS custom properties).
// Durations in seconds, as GSAP expects.
export const dur = { fast: 0.2, base: 0.6, slow: 1.2, draw: 1.1 } as const;

export const ease = {
  out: 'expo.out', // GSAP's closest named ease to --cbg-ease, cubic-bezier(0.22, 1, 0.36, 1)
  inOut: 'power2.inOut',
  none: 'none',
} as const;

export const stagger = 0.07;

export const reducedMotion = '(prefers-reduced-motion: reduce)';
export const fullMotion = '(prefers-reduced-motion: no-preference)';
