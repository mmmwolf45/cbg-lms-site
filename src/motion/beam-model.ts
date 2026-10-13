// The bending moment beam on the Structural page (templates/sections/course-beam.ts draws the static
// version, src/motion/beam.ts moves it). Pure maths and SVG path data, shared by the build and the page.
//
// A point load P at distance a along a beam of span L, three ways to support it. With the left end's
// moment MA and reaction RA (statics, standard results), the bending moment along the beam is
//   M(x) = MA + RA x - P <x - a>       (sagging positive)
// and the shear is RA left of the load, RA - P right of it.
//   simple:     MA = 0,              RA = P b / L                       (b = L - a)
//   fixed:      MA = -P a b^2 / L^2, RA = P b^2 (3a + b) / L^3
//   cantilever: MA = -P a,           RA = P                             (fixed at the left, free at the right)
// The page blends the three with weights (w, summing to 1) so a change of supports glides; every result
// is linear in the weights, so the blend is exactly the weighted sum.

export const TYPES = ['simple', 'fixed', 'cantilever'] as const;
export type Support = (typeof TYPES)[number];
export type Weights = readonly [number, number, number]; // one per TYPES entry

export function ends(type: Support, a: number) { // unit beam: L = 1, P = 1
  const b = 1 - a;
  if (type === 'simple') return { MA: 0, RA: b };
  if (type === 'fixed') return { MA: -a * b * b, RA: b * b * (3 * a + b) };
  return { MA: -a, RA: 1 };
}

// Each type's largest |M| over every load position (unit beam): it scales the diagram so each one fills
// its panel. simple: L/4 (load at midspan); fixed: 4/27 (support moment, load at L/3); cantilever: L.
export const PEAK = [0.25, 4 / 27, 1] as const;

export const N = 81; // points along the moment diagram

const mix = (w: Weights, f: (t: Support) => number) => TYPES.reduce((s, t, i) => s + w[i]! * f(t), 0);

// Bending moment at x (0..1) for the blend, unit beam.
export const momentAt = (w: Weights, a: number, x: number) =>
  mix(w, (t) => { const { MA, RA } = ends(t, a); return MA + RA * x - Math.max(0, x - a); });

// Shear just left of the load (right of it is one less), unit beam.
export const shearLeft = (w: Weights, a: number) => mix(w, (t) => ends(t, a).RA);

export const momentScale = (w: Weights) => TYPES.reduce((s, _, i) => s + w[i]! * PEAK[i]!, 0);

// The drawing's frame (viewBox 0 0 800 470): the beam from X0 to X1, the panels' baselines and heights.
export const G = { X0: 70, X1: 730, beamY: 110, mY: 275, mH: 70, vY: 414, vH: 44 } as const;
const px = (x: number) => G.X0 + x * (G.X1 - G.X0);
const r1 = (n: number) => Math.round(n * 10) / 10;

// The moment diagram on the tension side: sagging below the baseline, hogging above.
export function momentPath(w: Weights, a: number) {
  const k = G.mH / momentScale(w);
  let d = `M${G.X0} ${G.mY}`;
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1);
    d += `L${r1(px(x))} ${r1(G.mY + momentAt(w, a, x) * k)}`;
  }
  return `${d}L${G.X1} ${G.mY}Z`;
}

// The shear diagram: two steps with the jump under the load (positive drawn above the baseline).
export function shearPath(w: Weights, a: number) {
  const v = shearLeft(w, a) * G.vH;
  const xa = r1(px(a));
  return `M${G.X0} ${G.vY}V${r1(G.vY - v)}H${xa}V${r1(G.vY - (v - G.vH))}H${G.X1}V${G.vY}Z`;
}

// Main steel on the tension face: bottom bars under sagging, top bars over hogging, each run carried a
// little past the point where the moment changes sign (anchorage). Returns [bottom d, top d], drawn at y 0
// (the template moves each to its face).
const ANCHOR = 0.05; // of the span
export function barPaths(w: Weights, a: number): [string, string] {
  const tol = 0.004 * momentScale(w);
  const runs = (sign: 1 | -1) => {
    let d = '';
    let start = -1;
    for (let i = 0; i <= N; i++) {
      const x = i / (N - 1);
      const on = i < N && sign * momentAt(w, a, x) > tol;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        const s = Math.max(0, start - ANCHOR);
        const e = Math.min(1, (i - 1) / (N - 1) + ANCHOR);
        d += `M${r1(px(s))} 0H${r1(px(e))}`;
        start = -1;
      }
    }
    return d;
  };
  return [runs(1), runs(-1)];
}

export const weightsOf = (type: Support): Weights => TYPES.map((t) => (t === type ? 1 : 0)) as unknown as Weights;

// The figures for the readout, in kN and kN·m, whole numbers.
export function readout(type: Support, a: number, load: number, span: number) {
  const w = weightsOf(type);
  let sag = momentAt(w, a, a); // the exact peak under the load (sampling can miss it by a step)
  let hog = 0;
  for (let i = 0; i < N; i++) {
    const m = momentAt(w, a, i / (N - 1));
    sag = Math.max(sag, m);
    hog = Math.min(hog, m);
  }
  const v = shearLeft(w, a);
  const s = load * span;
  return { sag: Math.round(sag * s), hog: Math.abs(Math.round(hog * s)), shear: Math.round(Math.max(v, 1 - v) * load) };
}

// Where the load may sit: anywhere on a cantilever up to its tip; between the supports otherwise.
export const clampA = (type: Support, a: number) => Math.min(type === 'cantilever' ? 1 : 0.92, Math.max(0.08, a));

export const loadX = (a: number) => r1(px(a));

// Metres from the left end, one decimal.
export const atText = (a: number, span: number) => `${(a * span).toFixed(1)} m`;
