import type { Enhancer } from './setup';
import { fullMotion } from './tokens';

// The home band's floating desk (approved prototype, 4 Oct 2026): the plans, laptop and hard hat are
// separate cut-outs over the empty-desk photo. Nothing moves on its own. As the cursor (or a finger,
// while it touches the band) comes near, each object glides up, drifts and turns away from it, the
// nearest most, and eases back when it leaves: smooth, no spring. A tap or click turns one once, slowly.
// Reduced motion: nothing runs; the objects stay on the desk.

export const TAU = 260; // ms: how long a glide takes to settle (exponential smoothing, frame-rate independent)
export const SPIN_MS = 1400;

// How strongly the pointer pulls on an object: 1 right over it, easing to 0 at the edge of its reach
// (smoothstep). dx, dy are the object's offset from the pointer, in units of its reach.
export const influence = (dx: number, dy: number) => {
  const t = Math.max(0, 1 - Math.hypot(dx, dy));
  return t * t * (3 - 2 * t);
};

// Where an object heads for at influence f: lifted off the desk, drifted and turned away from the hand.
export function pose(f: number, dx: number, dy: number, depth: number) {
  const side = dx < 0 ? -1 : 1;
  const c = (v: number) => Math.max(-1, Math.min(1, v));
  return { lift: 26 * f * depth, x: 14 * f * side, rz: 5 * f * depth * side, ry: 24 * f * c(dx), rx: -9 * f * c(dy) };
}

// One glide step: the share of the remaining distance covered in dt ms.
export const glide = (dt: number) => 1 - Math.exp(-dt / TAU);

// The tap spin's angle at time t (0..1): one turn, eased in and out.
export const spinAngle = (t: number) => 360 * (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

type Pose = ReturnType<typeof pose>;
const KEYS = ['lift', 'x', 'rz', 'ry', 'rx'] as const;

function run(band: HTMLElement): () => void {
  const win = band.ownerDocument.defaultView!;
  const off = new AbortController();
  const opts = { passive: true, signal: off.signal } as const;
  const objs = [...band.querySelectorAll<HTMLElement>('[data-cbg-desk-object]')].map((el) => ({
    el,
    shadow: el.querySelector<HTMLElement>('.cbg-desk__shadow'),
    depth: Number(el.dataset.depth) || 1,
    axis: el.dataset.spin === 'z' ? 'z' : 'y',
    now: { lift: 0, x: 0, rz: 0, ry: 0, rx: 0 } as Pose,
    spinT: -1,
  }));
  if (!objs.length) return () => {};
  let pointer: { x: number; y: number } | null = null;
  let raf = 0;
  let last = 0;

  const frame = (time: number) => {
    raf = 0;
    const dt = last ? Math.min(64, time - last) : 16;
    last = time;
    const a = glide(dt);
    let moving = false;
    for (const o of objs) {
      // Resting position (offsets ignore transforms, so a lifted object never chases itself).
      const w = o.el.offsetWidth, h = o.el.offsetHeight;
      const reach = Math.max(w, h) * 1.15;
      let goal: Pose = { lift: 0, x: 0, rz: 0, ry: 0, rx: 0 };
      if (pointer) {
        const dx = (o.el.offsetLeft + w / 2 - pointer.x) / reach, dy = (o.el.offsetTop + h / 2 - pointer.y) / reach;
        const f = influence(dx, dy);
        if (f > 0) goal = pose(f, dx, dy, o.depth);
      }
      for (const k of KEYS) {
        o.now[k] += (goal[k] - o.now[k]) * a;
        if (Math.abs(goal[k] - o.now[k]) > 0.02) moving = true;
        else o.now[k] = goal[k];
      }
      let spin = 0;
      if (o.spinT >= 0) {
        o.spinT = Math.min(1, o.spinT + dt / SPIN_MS);
        spin = spinAngle(o.spinT);
        if (o.spinT >= 1) { o.spinT = -1; spin = 0; } else moving = true;
      }
      const n = o.now;
      const ry = n.ry + (o.axis === 'y' ? spin : 0), rz = n.rz + (o.axis === 'z' ? spin : 0);
      o.el.style.transform = n.lift || n.x || ry || rz || n.rx
        ? `translate3d(${n.x.toFixed(2)}px, ${(-n.lift).toFixed(2)}px, 0) rotateX(${n.rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`
        : '';
      if (o.shadow) {
        const lift = Math.max(0, n.lift);
        o.shadow.style.transform = lift ? `translateY(${lift.toFixed(1)}px) scale(${(1 + lift / 120).toFixed(3)})` : '';
        o.shadow.style.opacity = lift ? String(Math.max(0.25, 1 - lift / 70)) : '';
      }
    }
    if (moving) raf = win.requestAnimationFrame(frame);
    else last = 0;
  };
  const kick = () => {
    if (!raf && !off.signal.aborted) raf = win.requestAnimationFrame(frame);
  };

  // Pointer position in the coordinates of the objects' offset parent (the band's media layer).
  const stage = objs[0]!.el.offsetParent as HTMLElement | null;
  const at = (e: PointerEvent) => {
    const r = (stage ?? band).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  // Mouse: anywhere over the band. Touch and pen: while pressed (vertical scrolling still works).
  band.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) { pointer = at(e); kick(); } }, opts);
  band.addEventListener('pointerdown', (e) => { pointer = at(e); kick(); }, opts);
  band.addEventListener('pointerleave', () => { pointer = null; kick(); }, opts);
  band.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { pointer = null; kick(); } }, opts);
  band.addEventListener('pointercancel', () => { pointer = null; kick(); }, opts);
  // A tap or click on an object: one slow turn.
  for (const o of objs) {
    let down: { x: number; y: number; t: number } | null = null;
    o.el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }), opts);
    o.el.addEventListener('pointerup', (e) => {
      if (down && o.spinT < 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10 && performance.now() - down.t < 400) {
        o.spinT = 0;
        kick();
      }
      down = null;
    }, opts);
  }

  return () => {
    off.abort();
    if (raf) win.cancelAnimationFrame(raf);
    for (const o of objs) {
      o.el.style.transform = '';
      if (o.shadow) { o.shadow.style.transform = ''; o.shadow.style.opacity = ''; }
    }
  };
}

export const bandDesk: Enhancer = (roots) => {
  const bands = roots.flatMap((r) => [...r.querySelectorAll<HTMLElement>('[data-cbg-desk]')]);
  if (!bands.length) return;
  const mq = matchMedia(fullMotion);
  let stops: (() => void)[] = [];
  const start = () => {
    stops.forEach((f) => f());
    stops = mq.matches ? bands.map(run) : [];
  };
  start();
  mq.addEventListener?.('change', start);
  return () => {
    mq.removeEventListener?.('change', start);
    stops.forEach((f) => f());
  };
};
