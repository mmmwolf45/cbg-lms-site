import type { Enhancer } from './setup';
import { clamp01, frameDir, fullMotion, loadOrder, progress, smooth } from './tokens';

// The home hero's exploding building (SPEC section 5.1.1; approved prototype "effect A", 3 Oct 2026).
// [data-cbg-explode] carries the frames' base URL and count. While the page scrolls through the tall
// .cbg-explode (CSS: only with JS and motion allowed), the sticky stage plays the frames on a canvas,
// blending neighbours, and the headline comes apart with the building: lines separate, words drift and
// tilt, letters open (transforms only, so nothing reflows). The mouse tilts the building a little.
// Reduced motion: nothing runs; the poster (the assembled building) and the whole headline stay.
// The poster <picture> stays under the canvas, so a slow or failed frame never leaves a hole.

// One word's pose at explosion e (0..1, already smoothed): li = its line, c = the middle line index,
// k = its place among m words on the line. "far" is the muted word ("classroom"), which eases back a
// little but stays sharp (no blur or fade: it read as out of focus, 3 Oct 2026). Units: em and degrees.
export function wordPose(e: number, li: number, c: number, k: number, m: number, far: boolean) {
  const dy = ((li - c) * 0.32 - 0.2) * e; // lines separate, biased upward (the last line stays clear of the subtitle)
  const dx = (m > 1 ? (k - (m - 1) / 2) * 0.28 : li % 2 ? 0.1 : -0.1) * e; // words drift apart
  const rot = (li - c) * (li % 2 ? -1.6 : 1.6) * e;
  const scale = far ? 1 - 0.07 * e : li === 0 ? 1 + 0.03 * e : 1;
  return { dx, dy, rot, scale };
}

// How far each letter moves sideways (em) at explosion e: the spacing opens from the word's middle.
export const letterShift = (i: number, n: number, e: number) => (i - (n - 1) / 2) * 0.045 * e;

const N_DEFAULT = 48;
const EASE = 0.28; // the frame position catches up quickly but still glides when the scroll jumps
const STICKY_TOP = 56; // course.link's sticky navbar (home.css .cbg-explode__stage top)
const TILT = { y: 7, x: 4 }; // degrees at the screen edges

type Line = { words: number[] };

function run(section: HTMLElement): () => void {
  const pin = section.querySelector<HTMLElement>('.cbg-explode');
  const stage = section.querySelector<HTMLElement>('.cbg-explode__stage');
  const film = section.querySelector<HTMLElement>('.cbg-explode__film');
  const canvas = section.querySelector<HTMLCanvasElement>('.cbg-explode__canvas');
  const words = [...section.querySelectorAll<HTMLElement>('.cbg-w')];
  const chip = section.querySelector<HTMLElement>('.cbg-explode__chip');
  const ctx = canvas?.getContext('2d');
  if (!pin || !stage || !film || !canvas || !ctx || !words.length) return () => {};

  const win = section.ownerDocument.defaultView!;
  const off = new AbortController();
  const opts = { passive: true, signal: off.signal } as const;
  const n = Number(section.dataset.cbgFrames) || N_DEFAULT;
  const base = section.dataset.cbgExplode ?? '';
  const frames: (HTMLImageElement | undefined)[] = new Array(n);
  let raf = 0;
  let cur = 0; // eased frame position
  let painted = -1;
  let tx = 0, ty = 0, gx = 0, gy = 0; // tilt: current and goal, -1..1

  // ---- Frames ------------------------------------------------------------------------------------
  const ready = (j: number) => j >= 0 && j < n && !!frames[j]?.complete && (frames[j]?.naturalWidth ?? 0) > 0;
  const nearest = (i: number) => {
    for (let d = 0; d < n; d++) for (const j of [i - d, i + d]) if (ready(j)) return j;
    return -1;
  };
  const paint = (f: number) => {
    if (Math.abs(f - painted) < 0.002) return;
    const a = Math.floor(f);
    const j = ready(a) ? a : nearest(Math.round(f));
    if (j < 0) return;
    ctx.globalAlpha = 1;
    ctx.drawImage(frames[j]!, 0, 0, canvas.width, canvas.height);
    const t = f - a;
    if (j === a && t > 0.01 && ready(a + 1)) {
      ctx.globalAlpha = t;
      ctx.drawImage(frames[a + 1]!, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
    painted = j === a ? f : -1;
    canvas.dataset.frame = String(j); // the frame on show (tests read it: cross-origin pixels can't be read)
    canvas.classList.add('is-on'); // fades in over the poster
    film.classList.add('is-playing'); // and the poster steps out: blended with lighten it would fill every gap
  };
  const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true;
  if (base && !saveData) {
    const dir = frameDir(win.innerWidth, win.innerHeight, win.devicePixelRatio || 1);
    // Draw at the frames' own size: no upscaling of every frame on phones (640px frames).
    if (dir === 's') canvas.width = canvas.height = 640;
    const load = (i: number) =>
      new Promise<void>((done) => {
        const img = new Image();
        img.decoding = 'async';
        (img as { fetchPriority?: string }).fetchPriority = i === 0 ? 'high' : 'low';
        const settle = () => {
          done();
          if (off.signal.aborted) return;
          painted = -1;
          kick();
        };
        // Decode off the main thread before the frame is first drawn: an undecoded AVIF stalls the
        // frame that draws it (seen as 80-120 ms frames while scrolling).
        img.onload = () => void img.decode().catch(() => {}).finally(settle);
        img.onerror = settle;
        img.src = `${base}${dir}/f${String(i + 1).padStart(2, '0')}.avif`;
        frames[i] = img;
      });
    (async () => {
      const order = loadOrder(n);
      await load(order[0]!);
      if (!ready(0)) return; // AVIF unsupported or offline: the poster stays, the headline still moves
      for (let k = 1; k < order.length && !off.signal.aborted; k += 6) await Promise.all(order.slice(k, k + 6).map(load));
    })();
  }

  // ---- Headline ----------------------------------------------------------------------------------
  // Small screens skip the letter spreading (subtle there, and about 25 style writes a frame on a phone).
  const spreadLetters = win.matchMedia('(min-width: 768px)').matches;
  let lines: Line[] = [];
  const letters = words.map((w) => [...w.querySelectorAll<HTMLElement>('.cbg-l')]);
  const clear = () =>
    words.forEach((w, i) => {
      w.style.transform = '';
      letters[i]!.forEach((l) => (l.style.transform = ''));
    });
  // Group the words into rendered lines by their top edge (the headline wraps differently per width).
  const measure = () => {
    clear();
    const tops = words.map((w) => w.offsetTop);
    const size = parseFloat(win.getComputedStyle(words[0]!).fontSize) || 100;
    lines = [];
    tops.forEach((t, i) => {
      const line = lines.find((L) => Math.abs(tops[L.words[0]!]! - t) < size * 0.3);
      if (line) line.words.push(i);
      else lines.push({ words: [i] });
    });
    lines.sort((a, b) => tops[a.words[0]!]! - tops[b.words[0]!]!);
    lastE = -1;
  };
  let lastE = -1;
  const pose = (e: number) => {
    if (Math.abs(e - lastE) < 0.001) return;
    lastE = e;
    // The chip steps aside as the first line rises into its place; it returns on scroll up.
    if (chip) chip.style.opacity = e > 0.001 ? (1 - Math.min(1, e * 1.8)).toFixed(3) : '';
    const c = (lines.length - 1) / 2;
    lines.forEach((L, li) =>
      L.words.forEach((wi, k) => {
        const w = words[wi]!;
        const p = wordPose(e, li, c, k, L.words.length, w.classList.contains('cbg-w--dim'));
        w.style.transform = `translate(${p.dx.toFixed(3)}em, ${p.dy.toFixed(3)}em) rotate(${p.rot.toFixed(2)}deg) scale(${p.scale.toFixed(3)})`;
        if (!spreadLetters) return;
        const ls = letters[wi]!;
        ls.forEach((l, i) => (l.style.transform = `translateX(${letterShift(i, ls.length, e).toFixed(3)}em)`));
      }),
    );
  };

  // ---- Loop: runs only while something is still moving --------------------------------------------
  const tick = () => {
    raf = 0;
    const p = progress(pin.getBoundingClientRect().top, STICKY_TOP, pin.offsetHeight - stage.offsetHeight);
    const target = p * (n - 1);
    cur += (target - cur) * EASE;
    if (Math.abs(target - cur) < 0.01) cur = target;
    paint(cur);
    pose(smooth(cur / (n - 1)));
    tx += (gx - tx) * 0.1;
    ty += (gy - ty) * 0.1;
    if (Math.abs(gx - tx) < 0.001) tx = gx;
    if (Math.abs(gy - ty) < 0.001) ty = gy;
    film.style.transform = tx || ty ? `rotateY(${(tx * TILT.y).toFixed(2)}deg) rotateX(${(-ty * TILT.x).toFixed(2)}deg)` : '';
    if (cur !== target || tx !== gx || ty !== gy) raf = win.requestAnimationFrame(tick);
  };
  function kick() {
    if (!raf && !off.signal.aborted) raf = win.requestAnimationFrame(tick);
  }

  win.addEventListener('scroll', kick, opts);
  win.addEventListener('resize', () => { measure(); kick(); }, opts);
  win.addEventListener('pointermove', (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    gx = clamp01(e.clientX / win.innerWidth) * 2 - 1;
    gy = clamp01(e.clientY / win.innerHeight) * 2 - 1;
    kick();
  }, opts);
  section.ownerDocument.fonts?.ready.then(() => { if (!off.signal.aborted) { measure(); kick(); } });
  measure();
  // Start where the page already is (a reload mid-page), without gliding from frame 0.
  cur = progress(pin.getBoundingClientRect().top, STICKY_TOP, pin.offsetHeight - stage.offsetHeight) * (n - 1);
  kick();

  return () => {
    off.abort();
    if (raf) win.cancelAnimationFrame(raf);
    frames.forEach((f) => f && (f.onload = f.onerror = null));
    clear();
    if (chip) chip.style.opacity = '';
    film.style.transform = '';
    canvas.classList.remove('is-on');
    film.classList.remove('is-playing');
    canvas.width = canvas.height = 960;
    delete canvas.dataset.frame;
  };
}

// The headline is hidden until Plus Jakarta Sans is ready (critical.css), so the giant type never swaps
// font in view (a large layout shift). Shown when the font is ready, or after FONT_WAIT ms regardless.
const FONT_WAIT = 1200;
function revealWhenFontReady(sections: HTMLElement[]) {
  const show = () => sections.forEach((s) => s.querySelector('.cbg-explode__words')?.classList.add('is-ready'));
  const fonts = sections[0]?.ownerDocument.fonts;
  const timer = setTimeout(show, FONT_WAIT);
  const font = '800 100px "Plus Jakarta Sans"';
  if (!fonts?.load || fonts.check?.(font)) { clearTimeout(timer); show(); return; }
  fonts.load(font).then(show, show).finally(() => clearTimeout(timer));
}

export const explode: Enhancer = (roots) => {
  const sections = roots.flatMap((r) => [...r.querySelectorAll<HTMLElement>('[data-cbg-explode]')]);
  if (!sections.length) return;
  revealWhenFontReady(sections);
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
