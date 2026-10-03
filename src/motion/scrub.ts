import type { Enhancer } from './setup';
import { clamp01, fullMotion, loadOrder, progress } from './tokens';

// The QS hero, "from drawing to building to cost" (hero.visual: build-scrub). The top block carries the
// hero as an in-column visual (templates/sections/course-hero.ts): the poster (the finished villa) and the
// whole example take-off, which is what no JS and reduced motion show. With full motion this mounts a
// full-width stage of our own as the LAST child of course.link's header band (#course-header-bg), under
// the native title, subtitle, stats and enrol button (none of which are touched), and marks <html> with
// cbg-scrub-on. The stage sticks under the navbar while the band scrolls through its run, playing the
// footage frames on a canvas (as the home hero does, src/motion/explode.ts) and filling in the take-off
// row by row. Teardown removes the stage and the class, which leaves the band exactly as it was.
// If the stage can't be mounted safely (React hasn't hydrated the band in time, or replaced it), <html> gets
// cbg-scrub-off instead: the in-column hero shows and critical.css stops reserving the stage's height.
// Sizes come from critical.css (--cbg-scrub-h, --cbg-scrub-run on the band), so the first paint already
// reserves the stage's height and nothing below moves when it mounts.

export const ROW_SPAN = 0.15; // how much of the scrub one take-off row takes to count up
export const LAYOUT_WIDE = '(min-width: 1024px), (orientation: landscape)'; // scrub.css: table beside, not a strip

// Phones in portrait (the square footage) take the square frames unless the screen has the pixels for
// more (a tablet); everything else the 16:9 ones. The canvas fits either with object-fit: cover.
export const scrubDir = (w: number, dpr: number, wide: boolean) => (!wide && w * dpr <= 1280 ? 's' : 'l');

// 0..1 for row `at`: counts over ROW_SPAN, or what is left of the scrub after `at`.
export function rowT(p: number, at: number) {
  const s = Math.min(ROW_SPAN, 1 - at);
  return s <= 0 ? (p >= at ? 1 : 0) : clamp01((p - at) / s);
}

// The closing line shows once the last row has counted up.
export const totalShown = (p: number, ats: number[]) => p >= Math.min(1, Math.max(...ats) + ROW_SPAN) - 1e-6;

// The phone strip shows one row: the last one reached, or the first (dim) before any is.
export const currentRow = (p: number, ats: number[]) => ats.reduce((cur, at, i) => (p >= at ? i : cur), 0);

export const decimals = (n: number) => (String(n).split('.')[1] ?? '').length;

// "12345.5" with 1 decimal: "12,345.5". Not toLocaleString: the build (Node) and the page must agree.
export function fmtQty(n: number, dp = 0) {
  const [int, frac] = Math.abs(n).toFixed(dp).split('.');
  return `${n < 0 ? '-' : ''}${int!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${frac ? `.${frac}` : ''}`;
}

// The shown quantity at row progress t: counts up with an ease-out, to the row's own decimals.
export const qtyAt = (qty: number, t: number) => fmtQty(qty * (1 - (1 - t) ** 3), decimals(qty));

const EASE = 0.24; // the frame position catches up quickly but glides when the scroll jumps
const HYDRATION_WAIT = 5000; // ms: never insert into the band before React has hydrated it (see mount)

function mount(src: HTMLElement, band: HTMLElement, header: HTMLElement | null, lost: () => void): () => void {
  const doc = band.ownerDocument;
  const win = doc.defaultView!;
  const html = doc.documentElement;
  const off = new AbortController();
  const opts = { passive: true, signal: off.signal } as const;
  const n = Number(src.dataset.cbgFrames); // the schema checks it is at least 2
  const base = src.dataset.cbgScrub ?? '';
  const frames: (HTMLImageElement | undefined)[] = new Array(n);
  let raf = 0;
  let cur = 0;
  let painted = -1;
  let stickyTop = 56; // the stage's CSS top: under the 56px navbar, lower on phones (centred); see measure

  // ---- The stage: our own nodes, cloned from the in-column visual ------------------------------------
  const layer = doc.createElement('div');
  layer.className = 'cbg-scrub-x';
  layer.innerHTML = '<div class="cbg-scrub-x__stage"><div class="cbg-scrub-x__film"></div></div>';
  const stage = layer.firstElementChild as HTMLElement;
  const film = stage.firstElementChild as HTMLElement;
  const poster = src.querySelector('picture')?.cloneNode(true) as HTMLElement | undefined;
  if (poster) film.append(Object.assign(poster, { className: 'cbg-scrub-x__poster' }));
  const canvas = doc.createElement('canvas');
  canvas.className = 'cbg-scrub-x__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  film.append(canvas);
  const table = src.querySelector('.cbg-takeoff')?.cloneNode(true) as HTMLElement | undefined;
  if (table) {
    table.classList.add('cbg-takeoff--live');
    stage.append(table);
  }
  const rows = [...(table?.querySelectorAll<HTMLElement>('[data-cbg-at]') ?? [])];
  const ats = rows.map((r) => Number(r.dataset.cbgAt) || 0);
  // One text node per quantity, updated in place: replacing child nodes every frame would wake the page's
  // DOM watchers (setup.ts, router.ts), which watch child lists only.
  const qtys = rows.map((r) => {
    const q = r.querySelector<HTMLElement>('[data-cbg-qty]');
    if (!q) return undefined;
    const text = doc.createTextNode(q.textContent ?? '');
    q.replaceChildren(text);
    return { qty: Number(q.dataset.cbgQty), text };
  });
  const total = table?.querySelector<HTMLElement>('.cbg-takeoff__total');
  band.append(layer);
  html.classList.add('cbg-scrub-on');
  const ctx = canvas.getContext('2d');

  // Line the table up with the native header's content edges (course.link's container and padding).
  const measure = () => {
    stickyTop = parseFloat(win.getComputedStyle(stage).top) || 56;
    const b = band.getBoundingClientRect();
    const r = (header?.firstElementChild ?? header)?.getBoundingClientRect();
    if (!r?.width) return;
    layer.style.setProperty('--cbg-scrub-l', `${Math.round(r.left - b.left)}px`);
    layer.style.setProperty('--cbg-scrub-r', `${Math.round(b.right - r.right)}px`);
  };

  // ---- Take-off: rows brighten and count as the scrub passes them --------------------------------------
  let shown = -1;
  const fill = (p: number) => {
    if (p === shown) return;
    shown = p;
    const now = currentRow(p, ats);
    rows.forEach((row, i) => {
      const t = rowT(p, ats[i]!);
      row.classList.toggle('is-on', p >= ats[i]!);
      row.classList.toggle('is-now', i === now);
      const q = qtys[i];
      if (!q) return;
      const text = t > 0 ? qtyAt(q.qty, t) : '0';
      if (q.text.nodeValue !== text) q.text.nodeValue = text;
    });
    total?.classList.toggle('is-on', totalShown(p, ats));
  };

  // ---- Frames (as the home hero) -----------------------------------------------------------------------
  const ready = (j: number) => j >= 0 && j < n && !!frames[j]?.complete && (frames[j]?.naturalWidth ?? 0) > 0;
  const nearest = (i: number) => {
    for (let d = 0; d < n; d++) for (const j of [i - d, i + d]) if (ready(j)) return j;
    return -1;
  };
  const paint = (f: number) => {
    if (!ctx || Math.abs(f - painted) < 0.002) return;
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
    canvas.classList.add('is-on');
  };
  const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true;
  if (base && ctx && !saveData) {
    const dir = scrubDir(win.innerWidth, win.devicePixelRatio || 1, win.matchMedia(LAYOUT_WIDE).matches);
    [canvas.width, canvas.height] = dir === 's' ? [900, 900] : [1600, 900]; // the frames' own size (scripts/scrub-frames.ts)
    const load = (i: number) =>
      new Promise<void>((done) => {
        const img = new Image();
        img.decoding = 'async';
        (img as { fetchPriority?: string }).fetchPriority = i === 0 ? 'auto' : 'low'; // the poster is the LCP
        const settle = () => {
          done();
          if (off.signal.aborted) return;
          painted = -1;
          kick();
        };
        img.onload = () => void img.decode().catch(() => {}).finally(settle);
        img.onerror = settle;
        img.src = `${base}${dir}/f${String(i + 1).padStart(2, '0')}.avif`;
        frames[i] = img;
      });
    (async () => {
      const order = loadOrder(n);
      await load(order[0]!);
      if (!ready(0)) return; // AVIF unsupported or offline: the poster stays, the take-off still counts
      for (let k = 1; k < order.length && !off.signal.aborted; k += 6) await Promise.all(order.slice(k, k + 6).map(load));
    })();
  }

  // ---- Loop: runs only while something is still moving ---------------------------------------------
  const at = () => progress(layer.getBoundingClientRect().top, stickyTop, layer.offsetHeight - stage.offsetHeight);
  const tick = () => {
    raf = 0;
    if (!layer.isConnected) return lost(); // React re-rendered the band and dropped the stage
    const target = at() * (n - 1);
    cur += (target - cur) * EASE;
    if (Math.abs(target - cur) < 0.01) cur = target;
    paint(cur);
    fill(cur / (n - 1));
    if (cur !== target) raf = win.requestAnimationFrame(tick);
  };
  function kick() {
    if (!raf && !off.signal.aborted) raf = win.requestAnimationFrame(tick);
  }
  win.addEventListener('scroll', kick, opts);
  win.addEventListener('resize', () => { measure(); kick(); }, opts);
  measure();
  cur = at() * (n - 1); // start where the page already is (a reload mid-page), without gliding from 0
  fill(cur / (n - 1));
  kick();

  return () => {
    off.abort();
    if (raf) win.cancelAnimationFrame(raf);
    frames.forEach((f) => f && (f.onload = f.onerror = null));
    layer.remove();
    html.classList.remove('cbg-scrub-on');
  };
}

// React owns the band. Inserting into it before hydration would be a hydration mismatch (React would
// then re-render the page and drop our stage), so on a server-rendered first load (Vike's page context
// is in the page) wait until React has claimed the band. After a client-side change React rendered it.
const hydrated = (el: HTMLElement) =>
  !el.ownerDocument.getElementById('vike_pageContext') || Object.keys(el).some((k) => k.startsWith('__reactFiber'));

export const scrub: Enhancer = (roots) => {
  const src = roots.flatMap((r) => [...r.querySelectorAll<HTMLElement>('[data-cbg-scrub]')])[0];
  const doc = src?.ownerDocument;
  const band = doc?.getElementById('course-header-bg');
  if (!src || !band) return;
  const html = doc!.documentElement;
  const mq = matchMedia(fullMotion);
  let stop = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const since = Date.now();
  const start = () => {
    stop();
    stop = () => {};
    clearTimeout(timer);
    if (!mq.matches) return;
    if (band.isConnected && !hydrated(band) && Date.now() - since < HYDRATION_WAIT) {
      timer = setTimeout(start, 100);
      return;
    }
    // Not hydrated in time, or the band was replaced: never insert into it; the in-column hero shows.
    if (!band.isConnected || !hydrated(band)) return void html.classList.add('cbg-scrub-off');
    stop = mount(src, band, doc!.getElementById('course-header'), start);
  };
  start();
  mq.addEventListener?.('change', start);
  return () => {
    mq.removeEventListener?.('change', start);
    clearTimeout(timer);
    stop();
    html.classList.remove('cbg-scrub-off');
  };
};
