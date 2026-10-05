import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { frameSet, type Frames } from './frames';
import { gallery } from './gallery';
import { goldTrack } from './gold-track';
import { all } from './reveal';
import { bandLoading } from './site-orbit';
import type { Enhancer } from './setup';
import { clamp01, fullMotion, pinned, progress, smooth } from './tokens';

// The courses story (SPEC section 5.1.3; Maasoom, 6 Oct 2026). [data-cbg-story] holds (sticky, under the
// 56px navbar) for 0.6 of a screen of scroll per course card; each stretch is a chapter: that card shows (the
// others wait, hidden, in the same grid cell) beside its course film, which plays with the chapter's scroll.
// One canvas (.cbg-story__canvas) draws every film: one layer, and the chapter switch is a 0.6 s cross-fade
// on that canvas instead of two layers. Only frames near the one on show are decoded (frames.ts), and only
// for the active chapter and its two neighbours.
// Each card's <li data-film="<base>" data-frames="n"> names its square AVIF frames (<base>{l,s}/fNN.avif);
// a card without a film shows its photo, still. The position follows the scroll on a critically damped
// spring with a speed limit (as the band, site-orbit.ts), in real time; a jump of more than a chapter and a
// half snaps there and the cross-fade covers it.
// The settle (6 Oct 2026, Maasoom was skipping courses): when the scroll stops inside the story it glides
// (0.5 to 0.7 s, sine) to a chapter's middle, the next one in the direction scrolled but never more than one
// chapter from the last settle, and the film never runs past that chapter's middle while the scroll moves:
// a flick shows the next course, it can't skip one. ScrollTrigger's snap waits for the wheel, a finger and
// any momentum to stop, and gives way to any new scroll.
// Frames of the active chapter and the next load when the story is within a screen: frame 1, then (after
// the band's frames, or once the story reaches the navbar) every 4th and the rest. Phones get the small set.
// Fallback, the card gallery and its gold track (gallery.ts, gold-track.ts): reduced motion, Save-Data, no
// canvas 2D, the section already on screen when this runs, or the first film failing to load while the
// section is still below the screen (later, films that fail show their photos: no page jump).

const STICKY_TOP = 56; // course.link's sticky navbar (story.css)
const OMEGA = 2.8; // rad/s: settles about 1.7 s after the scroll stops
const MIN_S = 1.6; // one chapter's film takes at least this long, however hard the fling
const SNAP = 1.5; // chapters: further than this, jump and cross-fade
const NUDGE = 0.1; // chapters: a smaller move than this settles back where it was
const FADE = 600; // ms
const BATCH = 6;
const N_DEFAULT = 40;

type Chapter = {
  li: HTMLElement;
  base?: string;
  n: number;
  set?: Frames;
  wanted?: boolean;
  photo?: ImageBitmap;
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
  const ch: Chapter[] = lis.map((li) => ({ li, base: li.dataset.film, n: Number(li.dataset.frames) || N_DEFAULT }));
  let raf = 0, last = 0, cur = 0, vel = 0, span = 1, near = false, active = -1, filmSeen = false;
  let rest = 0, aim = 0; // the chapter the story last settled on, and the one a settle is gliding to
  let from = -1, fromAt = 0, fadeT0 = 0, painted = '', barAt = -1;

  section.classList.add('is-story');
  section.style.setProperty('--chapters', String(N));

  // ---- What a chapter shows at position t (0..1): its film's frames, else its photo --------------------
  const draw = (img: ImageBitmap, alpha: number) => {
    const iw = img.width, ih = img.height, s = Math.min(iw, ih); // square crop, like cover
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (iw - s) / 2, (ih - s) / 2, s, s, 0, 0, canvas.width, canvas.height);
  };
  // Draws chapter k at t (alpha 1, neighbouring frames blended) or, for the outgoing chapter of a fade, its
  // single nearest frame over it at alpha < 1. Returns false when it has nothing decoded yet.
  const paintChapter = (k: number, t: number, alpha: number) => {
    const c = ch[k]!, set = c.base ? c.set : undefined;
    const f = t * (c.n - 1), a = Math.floor(f);
    set?.focus(f);
    const j = set ? (set.get(a) ? a : set.nearest(Math.round(f))) : -1;
    if (j < 0) {
      if (!c.photo) return false;
      draw(c.photo, alpha);
      if (alpha === 1) delete canvas.dataset.frame;
      return true;
    }
    draw(set!.get(j)!, alpha);
    const next = set!.get(a + 1);
    if (alpha === 1 && j === a && f - a > 0.01 && next) draw(next, f - a);
    if (alpha === 1) canvas.dataset.frame = String(j); // tests read it: cross-origin pixels can't be read
    return true;
  };

  // ---- Loading --------------------------------------------------------------------------------------
  let queue: Promise<unknown> = Promise.resolve();
  let reach = () => {};
  const reached = new Promise<void>((r) => (reach = r)); // the story is at the navbar: the band is behind
  const want = (k: number) => {
    const c = ch[k];
    if (!c || c.wanted) return;
    c.wanted = true;
    // The photo: its own copy at the canvas's size (the card's <img> is hidden in the story and lazy).
    const src = c.li.querySelector('.cbg-course__media source[type="image/avif"]')?.getAttribute('srcset');
    if (!c.base && src) {
      const img = new Image();
      img.sizes = `${canvas.width}px`;
      img.srcset = src;
      img.decode().then(() => createImageBitmap(img)).then((b) => {
        c.photo = b; // decoded before its first draw, like the frames
        painted = '';
        kick();
      }, () => {});
      return;
    }
    if (!c.base) return;
    const set = (c.set ??= frameSet((i) => `${c.base}${dir}/f${String(i + 1).padStart(2, '0')}.avif`, c.n, () => {
      painted = '';
      kick();
    }, 5));
    // Frame 1 now, ahead of any queue; then every 4th and the rest, a batch at a time, one film after another,
    // after the band's frames (site-orbit.ts), which are on screen first, unless the story is already here.
    // A film whose chapter the reader has left (neither active nor next) stops; coming back resumes it.
    void (set.loaded(0) ? Promise.resolve(true) : set.load(0, true)).then((ok) => {
      if (off.signal.aborted) return;
      // AVIF unsupported or the films unreachable: the gallery instead, but only while the whole section is
      // still below the screen; the gallery is screens shorter, so swapping it in later shifts the page.
      if (!ok && !filmSeen && section.getBoundingClientRect().top >= win.innerHeight) return fail();
      if (!ok) {
        c.base = c.set = undefined; // this film failed (or the gallery came too late): its photo instead
        c.wanted = false;
        return want(k);
      }
      filmSeen = true;
      const order: number[] = [];
      for (const step of [4, 1]) for (let i = 0; i < c.n; i += step) if (i && !order.includes(i)) order.push(i);
      queue = Promise.all([queue, Promise.race([bandLoading, reached])]).then(async () => {
        for (let b = 0; b < order.length && !off.signal.aborted; b += BATCH) {
          if (k !== active && k !== active + 1) return void (c.wanted = false);
          await Promise.all(order.slice(b, b + BATCH).filter((i) => !set.loaded(i)).map((i) => set.load(i)));
        }
      });
    });
  };

  // ---- Layout and the loop ---------------------------------------------------------------------------
  const size = () => {
    span = Math.max(1, section.offsetHeight - wrap.offsetHeight);
    // The film box at device pixels, at most 1.5 per css px (2 on phones) and never more than the frames have.
    const dpr = Math.min(win.devicePixelRatio || 1, dir === 'l' ? 1.5 : 2);
    const px = Math.min(dir === 'l' ? 1000 : 560, Math.round(box.clientWidth * dpr)) || 1;
    if (canvas.width !== px) canvas.width = canvas.height = px; // clears it: repaint
    painted = '';
  };
  const raw = () => progress(section.getBoundingClientRect().top, STICKY_TOP, span) * N;
  // Inside the story the film stays between the middles of the chapters either side of the last settle.
  const goal = () => {
    const g = raw();
    pinned.story = g > 0 && g < N;
    if (g <= 0 || g >= N) rest = g <= 0 ? 0 : N - 1;
    return g <= 0 || g >= N ? g : Math.max(rest - 0.5, Math.min(rest + 1.5, g));
  };
  const setActive = (k: number) => {
    if (k === active) return;
    if (active >= 0) {
      from = active;
      fromAt = clamp01(cur - active);
      fadeT0 = performance.now();
    }
    active = k;
    lis.forEach((li, i) => li.classList.toggle('is-current', i === k));
    canvas.dataset.chapter = String(k);
    want(k);
    want(k + 1);
    // Decoded frames: the active chapter's (painting focuses them), the next one's start and the previous
    // one's end (where a chapter change lands); none for the others.
    ch.forEach((c, i) => (Math.abs(i - k) > 1 ? c.set?.drop() : i !== k && c.set?.focus(i > k ? 0 : c.n - 1)));
  };
  const paint = (now: number) => {
    const k = Math.min(N - 1, Math.floor(cur));
    setActive(k);
    const fade = from >= 0 ? (now - fadeT0) / FADE : 1;
    if (fade >= 1) from = -1;
    const key = `${cur.toFixed(3)} ${from >= 0 ? fade.toFixed(3) : ''} ${canvas.width}`;
    if (key === painted) return;
    const b = Math.round((cur / N) * 1000) / 1000;
    if (bar && b !== barAt) bar.style.transform = `scaleX(${(barAt = b)})`;
    if (!paintChapter(k, clamp01(cur - k), 1)) return; // nothing loaded yet: keep what is there
    if (from >= 0) paintChapter(from, fromAt, 1 - smooth(clamp01(fade)));
    ctx.globalAlpha = 1;
    painted = key;
    canvas.classList.add('is-on');
  };
  const tick = (now: number) => {
    raf = 0;
    const dt = (last ? Math.min(64, now - last) : 16.7) / 1000;
    last = now;
    const target = goal();
    if (target > 0) reach();
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
    if (!near) {
      pinned.story = false;
      return ch.forEach((c) => c.set?.drop()); // decoded frames go; the bytes stay for coming back
    }
    size();
    rest = Math.min(N - 1, Math.floor(raw()));
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

  // The settle. At progress p of the story, chapter k's middle is (k + 0.5) / N; the story's ends, 0 and 1.
  const settle = ScrollTrigger.create({
    trigger: section,
    start: `top ${STICKY_TOP}px`,
    end: () => `+=${section.offsetHeight - wrap.offsetHeight}`,
    snap: {
      snapTo: (p, self) => {
        const at = p * N - 0.5, d = self?.direction ?? 1;
        const k = Math.max(rest - 1, Math.min(rest + 1, d > 0 ? Math.ceil(at - NUDGE) : Math.floor(at + NUDGE)));
        const to = k < 0 ? 0 : k >= N ? 1 : (k + 0.5) / N;
        aim = Math.max(0, Math.min(N - 1, k));
        if (Math.abs(to - p) * N < 0.02) rest = aim; // already there: no glide
        return to;
      },
      // The film keeps to the old chapter's neighbours until the glide ends (or a new scroll takes over), so
      // gliding back from a flick never shows the chapters the flick overshot.
      onComplete: () => void (rest = aim),
      onInterrupt: () => void (rest = aim),
      duration: { min: 0.5, max: 0.7 },
      delay: 0.15,
      ease: 'sine.inOut',
      inertia: false,
    },
  });

  // Keyboard: a waiting card's link can take focus; scroll the story to that card's chapter and show it.
  section.addEventListener('focusin', (e) => {
    const k = lis.findIndex((li) => li.contains(e.target as Node));
    if (k < 0 || k === active) return;
    rest = k;
    win.scrollTo({ top: win.scrollY + section.getBoundingClientRect().top - STICKY_TOP + ((k + 0.5) / N) * span, behavior: 'instant' });
    cur = goal();
    vel = 0;
    setActive(k);
    kick();
  }, { signal: off.signal });

  return () => {
    off.abort();
    io.disconnect();
    pinned.story = false;
    settle.kill();
    if (raf) win.cancelAnimationFrame(raf);
    ch.forEach((c) => (c.set?.close(), c.photo?.close()));
    section.classList.remove('is-story');
    section.style.removeProperty('--chapters');
    lis.forEach((li) => li.classList.remove('is-current'));
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
