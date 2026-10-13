import { G, TYPES, atText, barPaths, clampA, loadX, momentPath, readout, shearPath, weightsOf, type Support } from './beam-model';
import type { Enhancer } from './setup';
import { reducedMotion } from './tokens';

// The bending moment beam (templates/sections/course-beam.ts, src/styles/beam.css). Loaded on its own
// (src/page-enhancers/course.ts) only when a page has one, so no other page carries its weight.
// The student moves the load (the range input, a mouse over the drawing, or a finger dragged across it)
// and picks the supports; the load and the diagrams glide to the new state (one exponential glide, TAU),
// and the readout jumps straight to the new figures. Reduced motion: no glide, every change is instant.
// The loop runs only while something is still moving.

export const TAU = 380; // ms: slow and smooth, never springy

// One glide step: how far toward the target after dt ms.
export const step = (dt: number, tau = TAU) => (tau <= 0 ? 1 : 1 - Math.exp(-dt / tau));

function run(fig: HTMLElement): () => void {
  const win = fig.ownerDocument.defaultView!;
  const off = new AbortController();
  const o = { signal: off.signal };
  const load = Number(fig.dataset.load);
  const span = Number(fig.dataset.span);
  const $ = <T extends Element>(sel: string) => fig.querySelector<T>(sel)!;
  const m = $<SVGPathElement>('.cbg-bmd__m');
  const v = $<SVGPathElement>('.cbg-bmd__v');
  const bars = [$<SVGPathElement>('[data-cbg-bar="bottom"]'), $<SVGPathElement>('[data-cbg-bar="top"]')];
  const arrow = $<SVGGElement>('.cbg-bmd__load');
  const sups = [...fig.querySelectorAll<SVGGElement>('[data-cbg-sup]')];
  const svg = $<SVGSVGElement>('svg');
  const types = $<HTMLElement>('.cbg-bmd__types');
  const slide = $<HTMLElement>('.cbg-bmd__slide');
  const input = slide.querySelector('input')!;
  const reads = new Map([...fig.querySelectorAll<HTMLElement>('[data-cbg-read]')].map((e) => [e.dataset.cbgRead, e]));
  const still = () => win.matchMedia(reducedMotion).matches;

  let type: Support = 'simple';
  let target = 0.5;
  let a = 0.5;
  let w = [...weightsOf(type)];
  let raf = 0;
  let last = 0;

  const draw = () => {
    const W = w as unknown as Parameters<typeof momentPath>[0];
    m.setAttribute('d', momentPath(W, a));
    v.setAttribute('d', shearPath(W, a));
    barPaths(W, a).forEach((d, i) => bars[i]!.setAttribute('d', d));
    arrow.setAttribute('transform', `translate(${loadX(a)} 0)`);
    sups.forEach((g, i) => g.setAttribute('opacity', String(Math.round(w[i]! * 100) / 100)));
  };
  const text = () => {
    const r = readout(type, target, load, span);
    const set = (k: string, s: string) => { const e = reads.get(k); if (e && e.textContent !== s) e.textContent = s; };
    set('at', atText(target, span));
    set('sag', `${r.sag} kN·m`);
    set('hog', `${r.hog} kN·m`);
    set('shear', `${r.shear} kN`);
    input.max = type === 'cantilever' ? '100' : '92'; // the load's range for these supports (clampA)
    input.value = String(Math.round(target * 100));
    input.setAttribute('aria-valuetext', `${atText(target, span)} from the left end`);
  };
  const tick = (now: number) => {
    raf = 0;
    const k = still() ? 1 : step(last ? Math.min(now - last, 64) : 16);
    last = now;
    const goal = weightsOf(type);
    a += (target - a) * k;
    w = w.map((x, i) => x + (goal[i]! - x) * k);
    const done = Math.abs(target - a) < 3e-3 && w.every((x, i) => Math.abs(x - goal[i]!) < 3e-3);
    if (done) {
      a = target;
      w = [...goal];
    }
    draw();
    if (done) last = 0;
    else raf = win.requestAnimationFrame(tick);
  };
  const go = () => { if (!raf) raf = win.requestAnimationFrame(tick); };
  const setA = (x: number) => { target = clampA(type, x); text(); go(); };
  const setType = (t: Support) => {
    type = t;
    types.querySelectorAll('[data-cbg-type]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-cbg-type') === t)));
    setA(target);
  };

  types.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-cbg-type]');
    if (b && TYPES.includes(b.dataset.cbgType as Support)) setType(b.dataset.cbgType as Support);
  }, o);
  input.addEventListener('input', () => setA(Number(input.value) / 100), o);
  // On the drawing: a mouse moves the load just by hovering. A finger or pen moves it only once the drag
  // is clearly sideways, so a vertical swipe that starts on the drawing scrolls the page and leaves the
  // load where it is (beam.css sets touch-action: pan-y); a tap with no drag places it.
  const toA = (e: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    return (((e.clientX - r.left) / r.width) * 800 - G.X0) / (G.X1 - G.X0);
  };
  let press: { x: number; y: number; id: number; drag: boolean } | undefined;
  svg.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return setA(toA(e));
    press = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false };
  }, o);
  svg.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') return setA(toA(e));
    if (!press || e.pointerId !== press.id) return;
    const dx = Math.abs(e.clientX - press.x);
    if (!press.drag && dx > 6 && dx > Math.abs(e.clientY - press.y)) {
      press.drag = true;
      svg.setPointerCapture?.(e.pointerId);
    }
    if (press.drag) setA(toA(e));
  }, o);
  svg.addEventListener('pointerup', (e) => {
    if (press && e.pointerId === press.id && !press.drag) setA(toA(e));
    press = undefined;
  }, o);
  svg.addEventListener('pointercancel', () => { press = undefined; }, o);

  types.hidden = false;
  slide.hidden = false;
  fig.classList.add('is-live');
  text();
  // A first hint that it moves: the load starts a quarter along and glides to midspan once the drawing
  // itself is well in view (the drawing, not the whole figure, which can be taller than a landscape phone).
  // Reduced motion: it simply sits at midspan.
  if (!still()) {
    a = 0.25;
    draw();
    const io = new IntersectionObserver(([en]) => {
      if (!en?.isIntersecting) return;
      io.disconnect();
      go();
    }, { threshold: 0.6 });
    io.observe($<HTMLElement>('.cbg-bmd__view'));
    off.signal.addEventListener('abort', () => io.disconnect());
  }

  return () => {
    off.abort();
    if (raf) win.cancelAnimationFrame(raf);
    // Back to the built starting state, so a re-run (React re-render, route change) starts clean.
    type = 'simple';
    target = a = 0.5;
    w = [...weightsOf(type)];
    draw();
    text();
    types.querySelectorAll('[data-cbg-type]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-cbg-type') === type)));
    types.hidden = true;
    slide.hidden = true;
    fig.classList.remove('is-live');
  };
}

export const beam: Enhancer = (roots) => {
  const undo = roots.flatMap((r) => [...r.querySelectorAll<HTMLElement>('[data-cbg-bmd]')]).map(run);
  return () => undo.forEach((f) => f());
};
