import { gsap } from 'gsap';
import { damp } from './glide';
import { all } from './reveal';
import type { Enhancer } from './setup';
import { clamp01, fullMotion, reducedMotion } from './tokens';

// The light ribbon behind the course cards (6 Oct 2026, Maasoom's pick from a reel; palette A, gold and starlight):
// a big bundle of glowing strands, as tall as the cards, running right behind them (it shows through their glass
// and in the gaps), twisting as it goes and sliding in from the left with the row's progress, its leading end a
// long soft fade. One canvas per row of cards, drawn once at layout at no more than 1.25x (the glow hides it; at an
// iPhone's 3x an SVG this size was a 55 MB texture), then only moved: a frame of the pan never repaints, which on
// the Intel UHD laptop costs 40-90 ms (docs/builds.md), and no clip or mask edge to show. Progress: laptop pin = the
// pan; phones = the row's scrollLeft; grid = once, when in view. Live cards get a faint border beam on hover or
// focus (CSS only, ribbon.css). Reduced motion: the ribbon in place and still.

const TAU = 0.3; // s, each of the two damped stages
const MAX_SPEED = 700; // px/s: even a flick of the scroll draws calmly
const LEAD = 360; // px: the leading (right) end's fade
const TAIL = 120; // px: the trailing end's fade
const RES = 1.25; // the canvas's pixels per CSS px, at most

// Across the ribbon, edge to edge: steel blue, starlight, a warm white core, CBG gold, bronze.
export const PALETTE = ['#5B7FC4', '#A9C1EE', '#FFF3D6', '#D6B160', '#A87B32'];
const STRANDS = 22;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// The colour at u (0..1) across the palette.
export function colourAt(u: number): string {
  const f = clamp01(u) * (PALETTE.length - 1);
  const i = Math.min(Math.floor(f), PALETTE.length - 2);
  const a = hex(PALETTE[i]!), b = hex(PALETTE[i + 1]!);
  return `#${a.map((v, k) => Math.round(v + (b[k]! - v) * (f - i)).toString(16).padStart(2, '0')).join('')}`;
}

// The ribbon's middle at x in a band h px tall: a slow wave. Strands spread round it.
// It runs a little below the cards' middle, through their glass bodies more than behind the text.
export const mid = (x: number, h: number) => 0.62 * h + 0.06 * h * Math.sin(x / 300 + 0.4);
// Signed: where it passes zero the strands cross, so the ribbon twists over (blue side and gold side swap).
const spread = (x: number, h: number) => 0.56 * h * Math.sin(x / 420 + 0.6);

// One path per strand across a row `width` px wide and h px tall, sampled every 16 px.
export function strands(width: number, h: number, n = STRANDS): string[] {
  return Array.from({ length: n }, (_, i) => {
    const u = i / (n - 1) - 0.5;
    let d = '';
    for (let x = 0; ; x = Math.min(width, x + 16)) {
      const y = mid(x, h) + u * spread(x, h) + 0.02 * h * Math.sin(x / (90 + i * 6) + i * 0.9);
      d += `${x ? 'L' : 'M'}${x.toFixed(0)} ${y.toFixed(1)}`;
      if (x >= width) return d;
    }
  });
}

type Row = { x: number; y: number; w: number; h: number; start: number };

// Cards in rows (a card lower down starts a new row), each row's ribbon behind its cards, from the first card's
// left edge to the last card's right edge and as tall as the tallest, and where it starts along all the rows'
// ribbons laid end to end.
export function rowsOf(cards: { x: number; y: number; w: number; h: number }[]): Row[] {
  const rows: Row[] = [];
  let start = 0;
  cards.forEach((c, i) => {
    const prev = cards[i - 1];
    const row = rows.at(-1);
    if (row && prev && Math.abs(prev.y - c.y) <= 4) {
      row.w = c.x + c.w - row.x;
      row.h = Math.max(row.h, c.h);
      return;
    }
    if (row) start += row.w;
    rows.push({ x: c.x, y: c.y, w: c.w, h: c.h, start });
  });
  return rows;
}

// How much of a row is drawn when the ribbons, laid end to end, are drawn to s px.
export const drawnIn = (row: Row, s: number) => clamp01((s - row.start) / Math.max(1, row.w));

// Paints a row's ribbon: each strand as a wide faint glow, then its line, then the two ends faded out.
function paint(canvas: HTMLCanvasElement, row: Row, dpr: number) {
  const { w, h } = row;
  const k = Math.min(dpr, RES);
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const c = canvas.getContext('2d');
  if (!c) return;
  c.scale(k, k);
  c.lineCap = c.lineJoin = 'round';
  const paths = strands(w, h).map((d) => new Path2D(d));
  for (const glow of [true, false]) {
    paths.forEach((p, i) => {
      const u = i / (STRANDS - 1);
      const core = 1 - Math.abs(u - 0.5) * 2; // 1 in the middle, 0 at the edges
      c.strokeStyle = colourAt(u);
      c.globalAlpha = glow ? 0.06 + core * 0.05 : 0.55 + core * 0.45;
      c.lineWidth = glow ? 8 + core * 8 : 1.1 + core * 1.9;
      c.stroke(p);
    });
  }
  const g = c.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(Math.min(TAIL, w / 6) / w, '#000');
  g.addColorStop(1 - Math.min(LEAD, w / 3) / w, '#000');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalCompositeOperation = 'destination-in';
  c.globalAlpha = 1;
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

function mount(section: HTMLElement, reduced: boolean): () => void {
  const gallery = section.querySelector<HTMLElement>('.cbg-gallery');
  const track = gallery?.querySelector<HTMLElement>('.cbg-gallery__track');
  if (!gallery || !track) return () => {};
  const off: (() => void)[] = [];
  const win = section.ownerDocument.defaultView!;

  for (const card of section.querySelectorAll('.cbg-course--live')) {
    const beam = document.createElement('span');
    beam.className = 'cbg-beam';
    beam.setAttribute('aria-hidden', 'true');
    card.append(beam);
    off.push(() => beam.remove());
  }

  const box = document.createElement('div');
  box.className = 'cbg-ribbons';
  box.setAttribute('aria-hidden', 'true');
  // Out of the flow inline (like flow.ts's canvas): before our CSS lands, or if it never does, it must not take
  // room in the page (in the flow the old track's SVG even changed course.link's navbar height,
  // e2e/native-home.spec.ts).
  box.style.cssText = 'position:absolute;left:0;top:0';
  gallery.prepend(box);
  off.push(() => box.remove());

  let rows: Row[] = [];
  let parts: HTMLCanvasElement[] = [];
  let total = 1; // all rows' ribbons end to end, px
  let shape = '';
  let phone = false;
  let panMax = 1; // the pan's full travel and the phone row's scroll range, px
  let swipeMax = 1;
  let drawn = -1;
  let m = 0; // first damped stage of the drawn length
  let v = 0; // second stage: what is drawn

  // Each row's ribbon slides in from the left: its leading end sits at the drawn share of the row.
  const draw = (s: number) => {
    if (Math.abs(s - drawn) < 0.05) return;
    drawn = s;
    rows.forEach((row, i) => {
      const x = row.x + (drawnIn(row, s) - 1) * row.w;
      parts[i]!.style.transform = `translate3d(${x.toFixed(1)}px,${row.y}px,0)`;
    });
  };

  // Offsets ignore the pan's transform and the reveal's lift (the track is the cards' offsetParent and the gallery
  // the track's, ribbon.css), so the ribbons share the track's own coordinates.
  const layout = () => {
    const lis = [...track.children] as HTMLElement[];
    if (!lis.length) return;
    const share = v / total, shareM = m / total;
    rows = rowsOf(lis.map((li) => ({ x: track.offsetLeft + li.offsetLeft, y: track.offsetTop + li.offsetTop, w: li.offsetWidth, h: li.offsetHeight })));
    total = Math.max(1, rows.reduce((n, r) => n + r.w, 0));
    // Repainted only when a row's size changes; a move just moves it.
    const next = rows.map((r) => `${r.w}x${r.h}`).join();
    if (next !== shape) {
      shape = next;
      box.replaceChildren(...rows.map(() => Object.assign(document.createElement('canvas'), { className: 'cbg-ribbon' })));
      parts = [...box.children] as HTMLCanvasElement[];
      rows.forEach((r, i) => paint(parts[i]!, r, win.devicePixelRatio || 1));
    }
    m = shareM * total;
    v = share * total;
    phone = getComputedStyle(gallery).overflowX === 'auto';
    panMax = Math.max(1, track.scrollWidth - track.clientWidth);
    swipeMax = Math.max(1, gallery.scrollWidth - gallery.clientWidth);
    drawn = -1;
    draw(reduced ? total : v);
  };

  // A late font and a resize (the gallery: the phone row's
  // scroll range changes with the screen even when the cards don't).
  const sizes = new ResizeObserver(layout);
  sizes.observe(track);
  sizes.observe(gallery);
  off.push(() => sizes.disconnect());
  // The pin switching the grid to one row (.is-pan, gallery.ts) can leave both boxes the same size, so watch for it too.
  const pin = new MutationObserver(layout);
  pin.observe(section, { attributes: true, attributeFilter: ['class'] });
  off.push(() => pin.disconnect());
  layout();
  if (reduced) return () => off.forEach((f) => f());

  let seen = false;
  let shiftX = 0;
  const tick = (_time: number, deltaMs: number) => {
    if (!rows.length) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const a = damp(dt, TAU);
    // Where the ribbon should reach, as a share of the row: pinned pan, phone swipe, or a grid seen once. All reads
    // come before the writes (the ribbons follow the pan), so a frame never forces a layout.
    const pan = section.classList.contains('is-pan');
    const x = pan ? (gsap.getProperty(track, 'x') as number) : 0;
    const p = pan ? -x / panMax : phone ? gallery.scrollLeft / swipeMax : seen ? 1 : 0;
    if (x !== shiftX) {
      shiftX = x;
      box.style.transform = x ? `translate3d(${x}px,0,0)` : '';
    }
    // Two damped stages (a soft start and a soft stop) and a speed cap.
    m += (clamp01(p) * total - m) * a;
    v += Math.max(-MAX_SPEED * dt, Math.min(MAX_SPEED * dt, (m - v) * a));
    draw(v);
  };

  // Runs only while the row is on screen.
  let on = false;
  const io = new IntersectionObserver(([e]) => {
    if (!e) return;
    if (e.isIntersecting) seen = true;
    if (e.isIntersecting === on) return;
    on = e.isIntersecting;
    if (on) gsap.ticker.add(tick);
    else gsap.ticker.remove(tick);
  }, { rootMargin: '0px 0px -15% 0px' });
  io.observe(gallery);
  off.push(() => {
    io.disconnect();
    gsap.ticker.remove(tick);
  });
  return () => off.forEach((f) => f());
}

// [data-cbg-gallery]: runs after gallery() (src/page-enhancers/home.ts). If the reduced-motion preference flips,
// matchMedia tears the ribbon down and builds it again in the other mode.
export const ribbon: Enhancer = (roots) => {
  const sections = all(roots, '[data-cbg-gallery]');
  if (!sections.length) return;
  const mm = gsap.matchMedia();
  mm.add({ reduced: reducedMotion, full: fullMotion }, (ctx) => {
    const undo = sections.map((s) => mount(s, !!ctx.conditions?.reduced));
    return () => undo.forEach((f) => f());
  });
  return () => mm.revert();
};
