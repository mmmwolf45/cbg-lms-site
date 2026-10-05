import { frameSet } from './frames';
import type { Enhancer } from './setup';
import { fullMotion, pinned, progress } from './tokens';

// The home band (SPEC section 5.1.2; Maasoom, 6 Oct 2026): a photoreal night construction site that turns
// about 60 degrees with the scroll. [data-cbg-orbit] carries the frames' base URL and count. While the page
// scrolls through the tall .cbg-orbit (CSS: only with JS and motion allowed), the sticky stage under the
// 56px navbar plays the frames on a canvas, blending neighbours, then lets go and the page carries on.
// The frames sit at equal steps of camera angle (scripts/orbit-frames.ts), so equal scroll = equal turn.
// The film follows the scroll on a critically damped spring (eases in and out, never overshoots) with a
// speed limit, both in real time, so the turn is equally slow at 60 or 120 Hz and a fling never jumps.
// Frames load only once the band is about a screen away: frame 1, every 4th, then the rest; only those
// near the one on show are decoded, off the main thread (frames.ts).
// Reduced motion, no JS, AVIF unsupported, Save-Data: the poster <picture> (frame 1), no sticky stretch.

const N_DEFAULT = 22;
const STICKY_TOP = 56; // course.link's sticky navbar (site-orbit.css .cbg-orbit__stage top)
const OMEGA = 2.8; // rad/s: settles about 1.7 s after the scroll stops
const MIN_S = 2.4; // the whole turn takes at least this long, however hard the fling (25 deg/s)
const BATCH = 6;

// Settles once the band's frames are all in (or it gave up); the course story's films queue behind it
// (course-story.ts), since the band is on screen first and both are a few MB.
export let bandLoading: Promise<void> = Promise.resolve();

function run(section: HTMLElement): () => void {
  const pin = section.querySelector<HTMLElement>('.cbg-orbit');
  const stage = section.querySelector<HTMLElement>('.cbg-orbit__stage');
  const film = section.querySelector<HTMLElement>('.cbg-orbit__film');
  const canvas = section.querySelector<HTMLCanvasElement>('.cbg-orbit__canvas');
  const ctx = canvas?.getContext('2d', { alpha: false });
  const base = section.dataset.cbgOrbit;
  const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true;
  if (!pin || !stage || !film || !canvas || !ctx || !base || saveData) return () => {};

  const win = section.ownerDocument.defaultView!;
  const off = new AbortController();
  const n = Number(section.dataset.cbgFrames) || N_DEFAULT;
  const dir = win.innerWidth < 768 ? 's' : 'l'; // phones: the 900px set
  let raf = 0, last = 0, cur = 0, vel = 0, painted = -1, near = false, span = 1;
  let sx = 0, sy = 0, sw = 0, sh = 0, iw = 0, ih = 0; // the source rectangle: the frame cropped like object-fit: cover
  const set = frameSet((i) => `${base}${dir}/f${String(i + 1).padStart(2, '0')}.avif`, n, () => {
    painted = -1;
    kick();
  });

  // ---- Frames ------------------------------------------------------------------------------------
  // The canvas holds the cropped frame at the film box's device pixels (at most 1.5 per css px, 2 on
  // phones, never more than the frame has); CSS stretches it over the film box, the same crop the poster's
  // object-fit: cover shows.
  const size = () => {
    span = Math.max(1, pin.offsetHeight - stage.offsetHeight);
    const w = film.clientWidth, h = film.clientHeight, a = w / h;
    if (!iw || !w || !h) return;
    [sw, sh] = a > iw / ih ? [iw, iw / a] : [ih * a, ih];
    sx = (iw - sw) / 2;
    sy = (ih - sh) / 2;
    const k = Math.min(1, (w * Math.min(win.devicePixelRatio || 1, dir === 's' ? 2 : 1.5)) / sw);
    canvas.width = Math.round(sw * k);
    canvas.height = Math.round(sh * k);
    painted = -1;
  };
  const draw = (j: number, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.drawImage(set.get(j)!, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  };
  const paint = (f: number) => {
    if (Math.abs(f - painted) < 0.002 || !sw) return;
    set.focus(f);
    const a = Math.min(n - 1, Math.floor(f)), t = f - a;
    const j = set.get(a) ? a : set.nearest(Math.round(f));
    if (j < 0) return;
    draw(j, 1);
    if (j === a && t > 0.01 && set.get(a + 1)) draw(a + 1, t); // the in-between: a cross-fade to the next frame
    ctx.globalAlpha = 1;
    painted = j === a ? f : -1;
    canvas.dataset.frame = String(j); // the frame on show (tests read it: cross-origin pixels can't be read)
    canvas.classList.add('is-on'); // fades in over the poster
  };
  const order = [0];
  for (const step of [4, 1]) for (let i = 0; i < n; i += step) if (!order.includes(i)) order.push(i);
  let loading = false;
  const loadAll = async () => {
    loading = true;
    if (!(await set.load(0, true)) || off.signal.aborted) return; // AVIF unsupported or offline: the poster stays
    ({ width: iw, height: ih } = set.get(0)!);
    size();
    kick();
    for (let k = 1; k < order.length && !off.signal.aborted; k += BATCH) await Promise.all(order.slice(k, k + BATCH).map((i) => set.load(i)));
  };

  // ---- Loop: runs only while the band is near and the film is still catching up -------------------
  const goal = () => progress(pin.getBoundingClientRect().top, STICKY_TOP, span) * (n - 1);
  const tick = (now: number) => {
    raf = 0;
    const dt = (last ? Math.min(64, now - last) : 16.7) / 1000;
    last = now;
    const target = goal();
    pinned.band = target > 0 && target < n - 1;
    const vmax = (n - 1) / MIN_S;
    vel += (OMEGA * OMEGA * (target - cur) - 2 * OMEGA * vel) * dt;
    vel = Math.max(-vmax, Math.min(vmax, vel));
    cur += vel * dt;
    if (Math.abs(target - cur) < 0.005 && Math.abs(vel) < 0.02) { cur = target; vel = 0; }
    paint(cur);
    if (cur !== target && near) raf = win.requestAnimationFrame(tick);
    else last = 0;
  };
  function kick() {
    if (!raf && near && !off.signal.aborted) raf = win.requestAnimationFrame(tick);
  }

  // Near = within about a screen of the band. Entering it starts the loading (once) and puts the film
  // where the page already is, so a jump or a reload mid-band never glides from frame 1.
  const io = new IntersectionObserver(([e]) => {
    near = !!e?.isIntersecting;
    if (!near) {
      pinned.band = false;
      return set.drop(); // its decoded frames go; the bytes stay for coming back
    }
    span = Math.max(1, pin.offsetHeight - stage.offsetHeight);
    cur = goal();
    vel = 0;
    painted = -1;
    if (!loading) bandLoading = loadAll();
    kick();
  }, { rootMargin: '100% 0px' });
  io.observe(section);
  const opts = { passive: true, signal: off.signal } as const;
  win.addEventListener('scroll', kick, opts);
  win.addEventListener('resize', () => { size(); kick(); }, opts); // resizing the canvas clears it: repaint

  return () => {
    off.abort();
    io.disconnect();
    pinned.band = false;
    if (raf) win.cancelAnimationFrame(raf);
    set.close();
    canvas.classList.remove('is-on');
    delete canvas.dataset.frame;
  };
}

export const siteOrbit: Enhancer = (roots) => {
  const sections = roots.flatMap((r) => [...r.querySelectorAll<HTMLElement>('[data-cbg-orbit]')]);
  if (!sections.length) return;
  const mq = matchMedia(fullMotion);
  let stops: (() => void)[] = [];
  const start = () => {
    stops.forEach((f) => f());
    stops = mq.matches ? sections.map(run) : [];
  };
  start();
  mq.addEventListener?.('change', start);
  return () => {
    mq.removeEventListener?.('change', start);
    stops.forEach((f) => f());
  };
};
