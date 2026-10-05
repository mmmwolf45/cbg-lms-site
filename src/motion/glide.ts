// Shared smoothing for the night-sky effects (strip, support, cursor, globe; picked 6 Oct 2026). Maasoom's rule:
// every motion slow and extremely smooth. So each one eases toward its target with a long time constant, frame-rate
// independent, and anything that follows the pointer has a speed cap: it never darts, jumps or overshoots.

// Share of the remaining distance to cover in dt seconds, for a time constant of tau seconds.
export const damp = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);

// Seconds since the last frame, capped so a dropped frame or a tab coming back never jumps.
export const frameDt = (now: number, last: number) => Math.max(0, Math.min(0.05, (now - last) / 1000));

// Factor that shortens a step (dx, dy) to at most max: 1 when it is already within.
export const capStep = (dx: number, dy: number, max: number) => {
  const d = Math.hypot(dx, dy);
  return d > max ? max / d : 1;
};

export const finePointer = '(hover: hover) and (pointer: fine)';
