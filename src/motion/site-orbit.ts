import type { Enhancer } from './setup';
import { fullMotion, progress } from './tokens';

// The home band (SPEC section 5.1.2; Maasoom, 6 Oct 2026): a photoreal night construction site that turns
// half way round with the scroll. [data-cbg-orbit] carries the frames' base URL and count. While the page
// scrolls through the tall .cbg-orbit (CSS: only with JS and motion allowed), the sticky stage under the
// 56px navbar plays the frames on a canvas, blending neighbours, then lets go and the page carries on.
// The frames sit at equal steps of camera angle (scripts/orbit-frames.ts), so equal scroll = equal turn.
// The film follows the scroll on a critically damped spring (eases in and out, never overshoots) with a
// speed limit, both in real time, so the turn is equally slow at 60 or 120 Hz and a fling never jumps.
// Frames load only once the band is about a screen away: frame 1, every 4th, then the rest.
// Reduced motion, no JS, AVIF unsupported, Save-Data: the poster <picture> (frame 1), no sticky stretch.

const N_DEFAULT = 64;
const STICKY_TOP = 56; // course.link's sticky navbar (site-orbit.css .cbg-orbit__stage top)
const OMEGA = 2.8; // rad/s: settles about 1.7 s after the scroll stops
const MIN_S = 3.2; // the whole half turn takes at least this long, however hard the fling
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
  const frames: (HTMLImageElement | undefined)[] = new Array(n);
  const ok: boolean[] = new Array(n).fill(false);
  let raf = 0, last = 0, cur = 0, vel = 0, painted = -1, near = false, span = 1;
  let sx = 0, sy = 0, sw = 0, sh = 0; // the source rectangle: the frame cropped like object-fit: cover

  // ---- Frames ------------------------------------------------------------------------------------
  const ready = (j: number) => j >= 0 && j < n && ok[j];
  const nearest = (i: number) => {
    for (let d = 0; d < n; d++) for (const j of [i - d, i + d]) if (ready(j)) return j;
    return -1;
  };
  // The canvas holds the cropped frame at its own pixels (1:1 copies, no scaling per draw); CSS stretches
  // it over the film box, the same crop the poster's object-fit: cover shows.
  const size = () => {
    const img = frames[nearest(0)];
    span = Math.max(1, pin.offsetHeight - stage.offsetHeight);
    if (!img || !film.clientWidth || !film.clientHeight) return;
    const iw = img.naturalWidth, ih = img.naturalHeight, a = film.clientWidth / film.clientHeight;
    [sw, sh] = a > iw / ih ? [iw, iw / a] : [ih * a, ih];
    sx = (iw - sw) / 2;
    sy = (ih - sh) / 2;
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    painted = -1;
  };
  const draw = (j: number, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.drawImage(frames[j]!, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  };
  const paint = (f: number) => {
    if (Math.abs(f - painted) < 0.002 || !sw) return;
    const a = Math.min(n - 1, Math.floor(f)), t = f - a;
    const j = ready(a) ? a : nearest(Math.round(f));
    if (j < 0) return;
    draw(j, 1);
    if (j === a && t > 0.01 && ready(a + 1)) draw(a + 1, t); // the in-between: a cross-fade to the next frame
    ctx.globalAlpha = 1;
    painted = j === a ? f : -1;
    canvas.dataset.frame = String(j); // the frame on show (tests read it: cross-origin pixels can't be read)
    canvas.classList.add('is-on'); // fades in over the poster
  };
  const load = (i: number) =>
    new Promise<void>((done) => {
      const img = new Image();
      img.decoding = 'async';
      // Decode off the main thread before the first draw: an undecoded AVIF stalls the frame that draws it.
      img.onload = () => void img.decode().catch(() => {}).finally(() => {
        done();
        if (off.signal.aborted) return;
        ok[i] = true;
        if (!sw) size();
        painted = -1;
        kick();
      });
      img.onerror = () => done();
      img.src = `${base}${dir}/f${String(i + 1).padStart(2, '0')}.avif`;
      frames[i] = img;
    });
  const order = [0];
  for (const step of [4, 1]) for (let i = 0; i < n; i += step) if (!order.includes(i)) order.push(i);
  let loading = false;
  const loadAll = async () => {
    loading = true;
    await load(order[0]!);
    if (!ready(0)) return; // AVIF unsupported or offline: the poster stays
    for (let k = 1; k < order.length && !off.signal.aborted; k += BATCH) await Promise.all(order.slice(k, k + BATCH).map(load));
  };

  // ---- Loop: runs only while the band is near and the film is still catching up -------------------
  const goal = () => progress(pin.getBoundingClientRect().top, STICKY_TOP, span) * (n - 1);
  const tick = (now: number) => {
    raf = 0;
    const dt = (last ? Math.min(64, now - last) : 16.7) / 1000;
    last = now;
    const target = goal();
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
    if (!near) return;
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
    if (raf) win.cancelAnimationFrame(raf);
    frames.forEach((f) => f && (f.onload = f.onerror = null));
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
