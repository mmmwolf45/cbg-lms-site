import { gallery } from './gallery';
import { goldTrack } from './gold-track';
import { all } from './reveal';
import type { Enhancer } from './setup';
import { clamp01, fullMotion, progress, smooth } from './tokens';

// The courses story (SPEC section 5.1; Maasoom, 6 Oct 2026). [data-cbg-story] holds (sticky, under the 56px
// navbar) for a screen of scroll per course card; each screen is a chapter: that card shows (the others
// wait, hidden, in the same grid cell) beside its course film, which plays with the chapter's scroll. One
// canvas (.cbg-story__canvas) draws every film: one decoded frame set in memory per chapter actually reached,
// one compositor layer, and the chapter switch is a 0.6 s cross-fade on that canvas instead of two layers.
// Each card's <li data-film="<base>" data-frames="n"> names its square AVIF frames (<base>{l,s}/fNN.avif);
// a card without a film shows its photo, still. The position follows the scroll on a critically damped
// spring with a speed limit (as the band, site-orbit.ts), in real time; a jump of more than a chapter and a
// half snaps there and the cross-fade covers it. Frames of the active chapter and the next load when the
// story is within a screen: frame 1, every 4th, then the rest. Phones (under 768px) get the small set.
// Fallback, the card gallery and its gold track (gallery.ts, gold-track.ts): reduced motion, Save-Data, no
// canvas 2D, the section already on screen when this runs, or the first film failing to load.

const STICKY_TOP = 56; // course.link's sticky navbar (story.css)
const OMEGA = 2.8; // rad/s: settles about 1.7 s after the scroll stops
const MIN_S = 1.6; // one chapter's film takes at least this long, however hard the fling
const SNAP = 1.5; // chapters: further than this, jump and cross-fade
const FADE = 600; // ms
const BATCH = 6;
const N_DEFAULT = 40;

type Chapter = {
  li: HTMLElement;
  base?: string;
  n: number;
  frames: HTMLImageElement[];
  ok: boolean[];
  wanted?: boolean;
  photo?: HTMLImageElement;
};

function run(section: HTMLElement, fail: () => void): (() => void) | undefined {
  const wrap = section.querySelector<HTMLElement>(':scope > .cbg-wrap');
  const box = section.querySelector<HTMLElement>('.cbg-story__film');
  const canvas = section.querySelector<HTMLCanvasElement>('.cbg-story__canvas');
  const bar = section.querySelector<HTMLElement>('.cbg-gallery__bar i');
  const ctx = canvas?.getContext('2d', { alpha: false });
  const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true;
  const lis = [...section.querySelectorAll<HTMLElement>('.cbg-gallery__track > li')];
  if (!wrap || !box || !canvas || !ctx || saveData || lis.length < 2) return undefined;

  const win = section.ownerDocument.defaultView!;
  const off = new AbortController();
  const dir = win.innerWidth < 768 ? 's' : 'l';
  const N = lis.length;
  const ch: Chapter[] = lis.map((li) => ({ li, base: li.dataset.film, n: Number(li.dataset.frames) || N_DEFAULT, frames: [], ok: [] }));
  let raf = 0, last = 0, cur = 0, vel = 0, span = 1, near = false, active = -1, filmSeen = false;
  let from = -1, fromAt = 0, fadeT0 = 0, painted = '', barAt = -1;

  section.classList.add('is-story');
  section.style.setProperty('--chapters', String(N));

  // ---- What a chapter shows at position t (0..1): its film's frames, else its photo --------------------
  const ready = (c: Chapter, j: number) => j >= 0 && j < c.n && c.ok[j];
  const nearest = (c: Chapter, i: number) => {
    for (let d = 0; d < c.n; d++) for (const j of [i - d, i + d]) if (ready(c, j)) return j;
    return -1;
  };
  const shown = (img?: HTMLImageElement) => !!img?.complete && img.naturalWidth > 0;
  const draw = (img: HTMLImageElement, alpha: number) => {
    const iw = img.naturalWidth, ih = img.naturalHeight, s = Math.min(iw, ih); // square crop, like cover
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (iw - s) / 2, (ih - s) / 2, s, s, 0, 0, canvas.width, canvas.height);
  };
  // Draws chapter k at t (alpha 1, neighbouring frames blended) or, for the outgoing chapter of a fade, its
  // single nearest frame over it at alpha < 1. Returns false when it has nothing loaded yet.
  const paintChapter = (k: number, t: number, alpha: number) => {
    const c = ch[k]!;
    const f = t * (c.n - 1), a = Math.floor(f);
    const j = c.base ? (ready(c, a) ? a : nearest(c, Math.round(f))) : -1;
    if (j < 0) {
      if (!shown(c.photo)) return false;
      draw(c.photo!, alpha);
      if (alpha === 1) delete canvas.dataset.frame;
      return true;
    }
    draw(c.frames[j]!, alpha);
    if (alpha === 1 && j === a && f - a > 0.01 && ready(c, a + 1)) draw(c.frames[a + 1]!, f - a);
    if (alpha === 1) canvas.dataset.frame = String(j); // tests read it: cross-origin pixels can't be read
    return true;
  };

  // ---- Loading --------------------------------------------------------------------------------------
  let queue = Promise.resolve();
  const load = (c: Chapter, i: number) =>
    new Promise<boolean>((done) => {
      const img = new Image();
      img.decoding = 'async';
      // Decoded before the first draw: an undecoded AVIF stalls the frame that draws it.
      img.onload = () => void img.decode().catch(() => {}).finally(() => {
        done(true);
        if (off.signal.aborted) return;
        c.ok[i] = true;
        painted = '';
        kick();
      });
      img.onerror = () => done(false);
      img.src = `${c.base}${dir}/f${String(i + 1).padStart(2, '0')}.avif`;
      c.frames[i] = img;
    });
  const want = (k: number) => {
    const c = ch[k];
    if (!c || c.wanted) return;
    c.wanted = true;
    // The photo: its own copy at the canvas's size (the card's <img> is hidden in the story and lazy).
    const src = c.li.querySelector('.cbg-course__media source[type="image/avif"]')?.getAttribute('srcset');
    if (!c.base && src) {
      c.photo = new Image();
      c.photo.onload = () => { painted = ''; kick(); };
      c.photo.sizes = `${canvas.width}px`;
      c.photo.srcset = src;
      return;
    }
    if (!c.base) return;
    // Frame 1 now, ahead of any queue; then every 4th and the rest, a batch at a time, one film after another.
    void load(c, 0).then((ok) => {
      if (off.signal.aborted) return;
      if (!ok && !filmSeen) return fail(); // AVIF unsupported or the films unreachable: the gallery instead
      if (!ok) {
        c.base = undefined; // only this film failed: its photo instead
        c.wanted = false;
        return want(k);
      }
      filmSeen = true;
      const order: number[] = [];
      for (const step of [4, 1]) for (let i = 0; i < c.n; i += step) if (i && !order.includes(i)) order.push(i);
      queue = queue.then(async () => {
        for (let b = 0; b < order.length && !off.signal.aborted; b += BATCH) await Promise.all(order.slice(b, b + BATCH).map((i) => load(c, i)));
      });
    });
  };

  // ---- Layout and the loop ---------------------------------------------------------------------------
  const size = () => {
    span = Math.max(1, section.offsetHeight - wrap.offsetHeight);
    const px = Math.min(dir === 'l' ? 1000 : 560, Math.round(box.clientWidth * win.devicePixelRatio)) || 1;
    if (canvas.width !== px) canvas.width = canvas.height = px; // clears it: repaint
    painted = '';
  };
  const goal = () => progress(section.getBoundingClientRect().top, STICKY_TOP, span) * N;
  const setActive = (k: number) => {
    if (k === active) return;
    if (active >= 0) {
      from = active;
      fromAt = clamp01(cur - active);
      fadeT0 = performance.now();
    }
    active = k;
    lis.forEach((li, i) => li.classList.toggle('is-active', i === k));
    canvas.dataset.chapter = String(k);
    want(k);
    want(k + 1);
  };
  const paint = (now: number) => {
    const k = Math.min(N - 1, Math.floor(cur));
    setActive(k);
    const fade = from >= 0 ? (now - fadeT0) / FADE : 1;
    if (fade >= 1) from = -1;
    const key = `${cur.toFixed(3)} ${from >= 0 ? fade.toFixed(3) : ''} ${canvas.width}`;
    if (key === painted) return;
    if (!paintChapter(k, clamp01(cur - k), 1)) return; // nothing loaded yet: keep what is there
    if (from >= 0) paintChapter(from, fromAt, 1 - smooth(clamp01(fade)));
    ctx.globalAlpha = 1;
    painted = key;
    canvas.classList.add('is-on');
    const b = Math.round((cur / N) * 1000) / 1000;
    if (bar && b !== barAt) bar.style.transform = `scaleX(${(barAt = b)})`;
  };
  const tick = (now: number) => {
    raf = 0;
    const dt = (last ? Math.min(64, now - last) : 16.7) / 1000;
    last = now;
    const target = goal();
    if (Math.abs(target - cur) > SNAP) { cur = target; vel = 0; }
    const vmax = 1 / MIN_S;
    vel += (OMEGA * OMEGA * (target - cur) - 2 * OMEGA * vel) * dt;
    vel = Math.max(-vmax, Math.min(vmax, vel));
    cur += vel * dt;
    if (Math.abs(target - cur) < 0.0005 && Math.abs(vel) < 0.002) { cur = target; vel = 0; }
    paint(now);
    if ((cur !== target || from >= 0) && near) raf = win.requestAnimationFrame(tick);
    else last = 0;
  };
  function kick() {
    if (!raf && near && !off.signal.aborted) raf = win.requestAnimationFrame(tick);
  }

  // Near = within about a screen. Arriving puts the story where the page already is (a reload or a jump
  // mid-story never glides through the chapters before it).
  const io = new IntersectionObserver(([e]) => {
    near = !!e?.isIntersecting;
    if (!near) return;
    size();
    cur = goal();
    vel = 0;
    from = -1;
    setActive(Math.min(N - 1, Math.floor(cur)));
    kick();
  }, { rootMargin: '100% 0px' });
  io.observe(section);
  const opts = { passive: true, signal: off.signal } as const;
  win.addEventListener('scroll', kick, opts);
  win.addEventListener('resize', () => { size(); kick(); }, opts);

  // Keyboard: a waiting card's link can take focus; scroll the story to that card's chapter and show it.
  section.addEventListener('focusin', (e) => {
    const k = lis.findIndex((li) => li.contains(e.target as Node));
    if (k < 0 || k === active) return;
    win.scrollTo({ top: win.scrollY + section.getBoundingClientRect().top - STICKY_TOP + ((k + 0.5) / N) * span, behavior: 'instant' });
    cur = goal();
    vel = 0;
    setActive(k);
    kick();
  }, { signal: off.signal });

  return () => {
    off.abort();
    io.disconnect();
    if (raf) win.cancelAnimationFrame(raf);
    ch.forEach((c) => c.frames.forEach((f) => (f.onload = f.onerror = null)));
    section.classList.remove('is-story');
    section.style.removeProperty('--chapters');
    lis.forEach((li) => li.classList.remove('is-active'));
    bar?.style.removeProperty('transform');
    canvas.classList.remove('is-on');
    delete canvas.dataset.frame;
    delete canvas.dataset.chapter;
  };
}

// The story, or its fallback: the card gallery (gallery.ts) with the gold track (gold-track.ts), which handle
// reduced motion themselves. The story starts only while the whole section is below the screen, since it
// makes the section six screens tall; a reader already past it keeps the gallery for this page view.
export const courseStory: Enhancer = (roots) => {
  const section = all(roots, '[data-cbg-story]')[0];
  const fallback = () => {
    const undo = [gallery(roots), goldTrack(roots)];
    return () => undo.forEach((f) => f?.());
  };
  if (!section) return fallback();
  const mq = matchMedia(fullMotion);
  let stop = () => {};
  const start = () => {
    stop();
    const story = mq.matches && section.getBoundingClientRect().top >= innerHeight
      ? run(section, () => { stop(); stop = fallback(); })
      : undefined;
    stop = story ?? fallback();
  };
  start();
  mq.addEventListener?.('change', start);
  return () => {
    mq.removeEventListener?.('change', start);
    stop();
  };
};
