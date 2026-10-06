import { gsap } from 'gsap';
import { damp } from './glide';
import { all } from './reveal';
import type { Enhancer } from './setup';
import { clamp01, fullMotion, reducedMotion, smooth } from './tokens';

// The light ribbon under the course cards (replaced the gold track on 6 Oct 2026: Maasoom's pick from a reel, a
// bundle of glowing strands that draws in with the row; palette A, gold and starlight). Per row of cards, an SVG
// of fine strands drawn once at layout and revealed by two counter-moving transforms (the clip and the art), so a
// frame of the pan only moves layers and never repaints: on the Intel UHD laptop any repaint during a scroll costs
// the frame 40-90 ms (docs/builds.md). No CSS masks on those layers either (a mask on a moving layer cost that laptop
// more than the ribbon itself, lab/ab-perf.mjs): the ends fade inside the SVG and the front light hides the cut. A soft light rides the front edge and a fainter one drifts slowly along the
// drawn part. Progress: laptop pin = the pan; phones = the row's scrollLeft; grid = once, when in view. Live cards
// get a faint border beam on hover or focus (CSS only, ribbon.css). Reduced motion: the ribbon whole and still.

export const DROP = 22; // ribbon centre below the cards' bottom edge (the track leaves 44px for it, ribbon.css)
export const BAND = 40; // ribbon height
const PULSE = 64; // px/s along the drawn part
const TAU = 0.3; // s, each of the two damped stages
const MAX_SPEED = 700; // px/s: even a flick of the scroll draws calmly
const HEAD = 28; // the front light's radius

// Across the ribbon, edge to edge: steel blue, starlight, a warm white core, CBG gold, bronze.
export const PALETTE = ['#5B7FC4', '#A9C1EE', '#FFF3D6', '#D6B160', '#A87B32'];
const STRANDS = 15;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// The colour at u (0..1) across the palette.
export function colourAt(u: number): string {
  const f = clamp01(u) * (PALETTE.length - 1);
  const i = Math.min(Math.floor(f), PALETTE.length - 2);
  const a = hex(PALETTE[i]!), b = hex(PALETTE[i + 1]!);
  return `#${a.map((v, k) => Math.round(v + (b[k]! - v) * (f - i)).toString(16).padStart(2, '0')).join('')}`;
}

// The ribbon's middle at x: a slow wave. Strands spread round it and pinch where the ribbon "twists".
export const mid = (x: number) => BAND / 2 + 3 * Math.sin(x / 130 + 0.4);
// Signed: where it passes zero the strands cross, so the ribbon twists over (blue side and gold side swap).
const spread = (x: number) => 26 * Math.sin(x / 230 + 0.6);

// One path per strand across a row `width` px wide, sampled every 16 px.
export function strands(width: number, n = STRANDS): string[] {
  return Array.from({ length: n }, (_, i) => {
    const u = i / (n - 1) - 0.5;
    let d = '';
    for (let x = 0; ; x = Math.min(width, x + 16)) {
      const y = mid(x) + u * spread(x) + 2.5 * Math.sin(x / (45 + i * 3) + i * 0.9);
      d += `${x ? 'L' : 'M'}${x.toFixed(0)} ${y.toFixed(1)}`;
      if (x >= width) return d;
    }
  });
}

type Row = { x: number; y: number; w: number; start: number };

// Cards in rows (a card lower down starts a new row), each row's ribbon from its first card's left edge to its
// last card's right edge, and where it starts along all the rows' ribbons laid end to end.
export function rowsOf(cards: { x: number; y: number; w: number; h: number }[]): Row[] {
  const rows: Row[] = [];
  let start = 0;
  cards.forEach((c, i) => {
    const prev = cards[i - 1];
    const row = rows.at(-1);
    if (row && prev && Math.abs(prev.y - c.y) <= 4) {
      row.w = c.x + c.w - row.x;
      row.y = Math.max(row.y, c.y + c.h + DROP - BAND / 2);
      return;
    }
    if (row) start += row.w;
    rows.push({ x: c.x, y: c.y + c.h + DROP - BAND / 2, w: c.w, start });
  });
  return rows;
}

// How much of a row is drawn when the ribbons, laid end to end, are drawn to s px.
export const drawnIn = (row: Row, s: number) => clamp01((s - row.start) / Math.max(1, row.w));

function art(row: Row, k: number): string {
  const paths = strands(row.w)
    .map((d, i) => {
      const u = i / (STRANDS - 1);
      const core = 1 - Math.abs(u - 0.5) * 2; // 1 in the middle, 0 at the edges
      return `<path d="${d}" stroke="${colourAt(u)}" stroke-width="${(0.7 + core * 0.9).toFixed(2)}" stroke-opacity="${(0.6 + core * 0.4).toFixed(2)}"/>`;
    })
    .join('');
  return `<svg class="cbg-ribbon__art" width="${row.w}" height="${BAND}" viewBox="0 0 ${row.w} ${BAND}" aria-hidden="true" focusable="false">
<defs><linearGradient id="cbg-rb-fade${k}" gradientUnits="userSpaceOnUse" x1="0" x2="${row.w}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${(56 / row.w).toFixed(4)}" stop-color="#fff"/><stop offset="${(1 - 56 / row.w).toFixed(4)}" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="cbg-rb-ends${k}" maskUnits="userSpaceOnUse" x="0" y="0" width="${row.w}" height="${BAND}"><rect width="${row.w}" height="${BAND}" fill="url(#cbg-rb-fade${k})"/></mask><filter id="cbg-rb-glow${k}" x="-2%" y="-50%" width="104%" height="200%"><feGaussianBlur stdDeviation="2.5"/><feComponentTransfer><feFuncA type="linear" slope="2.2"/></feComponentTransfer></filter></defs>
<g fill="none" stroke-linecap="round" mask="url(#cbg-rb-ends${k})"><g id="cbg-rb${k}">${paths}</g><use href="#cbg-rb${k}" filter="url(#cbg-rb-glow${k})" opacity=".8"/></g></svg>`;
}

function mount(section: HTMLElement, reduced: boolean): () => void {
  const gallery = section.querySelector<HTMLElement>('.cbg-gallery');
  const track = gallery?.querySelector<HTMLElement>('.cbg-gallery__track');
  if (!gallery || !track) return () => {};
  const off: (() => void)[] = [];

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
  const spark = document.createElement('i');
  spark.className = 'cbg-ribbon__spark';
  gallery.prepend(box);
  off.push(() => box.remove());

  let rows: Row[] = [];
  let parts: { clip: HTMLElement; art: HTMLElement; head: HTMLElement }[] = [];
  let total = 1; // all rows' ribbons end to end, px
  let shape = '';
  let phone = false;
  let panMax = 1; // the pan's full travel and the phone row's scroll range, px
  let swipeMax = 1;
  let drawn = -1;
  let m = 0; // first damped stage of the drawn length
  let v = 0; // second stage: what is drawn

  const draw = (s: number) => {
    if (Math.abs(s - drawn) < 0.05) return;
    drawn = s;
    rows.forEach((row, i) => {
      const r = drawnIn(row, s);
      const t = (r - 1) * row.w;
      const p = parts[i]!;
      p.clip.style.transform = `translate3d(${t.toFixed(1)}px,0,0)`;
      p.art.style.transform = `translate3d(${(-t).toFixed(1)}px,0,0)`;
      const x = r * row.w;
      p.head.style.transform = `translate3d(${(x - HEAD).toFixed(1)}px,${(mid(x) - HEAD).toFixed(1)}px,0)`;
      // The front light shows while that row is drawing and fades at both ends.
      p.head.style.opacity = reduced ? '0' : (smooth(clamp01(r / 0.06)) * smooth(clamp01((1 - r) / 0.06))).toFixed(3);
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
    // Redrawn only when a row's size changes; a move just moves it.
    const next = rows.map((r) => r.w).join();
    if (next !== shape) {
      shape = next;
      box.innerHTML = rows.map((r, k) => `<div class="cbg-ribbon" style="width:${r.w}px;height:${BAND}px"><div class="cbg-ribbon__clip">${art(r, k)}</div><i class="cbg-ribbon__head"></i></div>`).join('');
      box.append(spark);
      parts = [...box.querySelectorAll<HTMLElement>('.cbg-ribbon')].map((el) => ({
        clip: el.querySelector<HTMLElement>('.cbg-ribbon__clip')!,
        art: el.querySelector<HTMLElement>('.cbg-ribbon__art')!,
        head: el.querySelector<HTMLElement>('.cbg-ribbon__head')!,
      }));
    }
    rows.forEach((r, i) => ((box.children[i] as HTMLElement).style.translate = `${r.x}px ${r.y}px`));
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
  let s = 0; // the drifting light's position (px along its row)
  let row = 0;
  let rest = 0;
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

    // The drifting light: one slow pass along the drawn part of a row, a rest, then the next row.
    const r = rows[row]!;
    const end = drawnIn(r, v) * r.w;
    s += PULSE * dt;
    if (s > end || end < 120) {
      spark.style.opacity = '0';
      if ((rest += dt) > 2.4) {
        rest = 0;
        row = (row + 1) % rows.length;
        s = 0;
      }
      return;
    }
    spark.style.transform = `translate3d(${(r.x + s - 20).toFixed(1)}px,${(r.y + mid(s) - 20).toFixed(1)}px,0)`;
    spark.style.opacity = (smooth(clamp01(s / 140)) * smooth(clamp01((end - s) / 140))).toFixed(3);
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
