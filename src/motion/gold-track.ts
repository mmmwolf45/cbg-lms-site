import { gsap } from 'gsap';
import { damp } from './glide';
import { all } from './reveal';
import type { Enhancer } from './setup';
import { clamp01, fullMotion, reducedMotion, smooth } from './tokens';

// The gold track under the course cards (plain theme of the lab's carousel, picked 6 Oct 2026; lab/fx/carousel.js).
// One SVG behind the row: a faint guide through a node under each card, a gold copy of it that draws in with the
// row's progress (laptop pin: the pan; phones: the row's scrollLeft; grid: once, when in view), nodes that light
// as the line reaches them and a soft light drifting slowly along the drawn part. Live cards get a faint border
// beam on hover or focus (CSS only, gold-track.css). Reduced motion: still, the line whole, every node lit.

const NS = 'http://www.w3.org/2000/svg';
const DROP = 22; // node centre below the card's bottom edge (the track leaves 44px for it, gold-track.css)
const WAVE = 6; // the line sags this far up or down between nodes
const PULSE = 64; // px/s along the line
const TAU = 0.3; // s, each of the two damped stages
const MAX_SPEED = 700; // px/s: even a flick of the scroll draws calmly

type Pt = { x: number; y: number };

// Path segments through the nodes: a gentle alternating wave along a row; a node lower down starts a new row
// (a grid's next line of cards) with a move, not a line across the cards.
export function waveParts(pts: Pt[]): string[] {
  let s = 1;
  return pts.map((p, i) => {
    const prev = pts[i - 1];
    if (!prev || Math.abs(prev.y - p.y) > 4) {
      s = 1;
      return `M${p.x} ${p.y}`;
    }
    const k = (p.x - prev.x) * 0.4;
    const part = `C${prev.x + k} ${prev.y + s * WAVE} ${p.x - k} ${p.y + s * WAVE} ${p.x} ${p.y}`;
    s = -s;
    return part;
  });
}

// lens[i] = path length up to node i. Progress p (0..1) as a fractional node index, as a length: the line
// reaches card i exactly when the row is i/(n-1) of the way through.
export function lengthAt(lens: number[], p: number): number {
  if (!lens.length) return 0;
  const f = clamp01(p) * (lens.length - 1);
  const i = Math.floor(f);
  const j = Math.min(i + 1, lens.length - 1);
  return lens[i]! + (lens[j]! - lens[i]!) * (f - i);
}

// The inverse of lengthAt, so a resize (new lengths) keeps the line at the same nodes.
export function shareOf(lens: number[], len: number): number {
  if (lens.length < 2) return 0;
  let i = 0;
  while (i < lens.length - 2 && lens[i + 1]! <= len) i++;
  const span = lens[i + 1]! - lens[i]!;
  return (i + (span ? clamp01((len - lens[i]!) / span) : 0)) / (lens.length - 1);
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

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'cbg-track');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  // Out of the flow inline (like flow.ts's canvas): before our CSS lands, or if it never does, the SVG must not
  // take room in the page (in the flow it even changed course.link's navbar height, e2e/native-home.spec.ts).
  svg.style.cssText = 'position:absolute;left:0;top:0';
  svg.innerHTML = `<defs><radialGradient id="cbg-track-glow"><stop offset="0" stop-color="#D6B160" stop-opacity=".55"/><stop offset=".45" stop-color="#D6B160" stop-opacity=".16"/><stop offset="1" stop-color="#D6B160" stop-opacity="0"/></radialGradient></defs>
<path class="cbg-track__guide"/><path class="cbg-track__line"/><g></g><circle class="cbg-track__pulse" r="16" fill="url(#cbg-track-glow)" opacity="0"/>`;
  gallery.prepend(svg);
  off.push(() => svg.remove());
  const guide = svg.querySelector<SVGPathElement>('.cbg-track__guide')!;
  const line = svg.querySelector<SVGPathElement>('.cbg-track__line')!;
  const group = svg.querySelector('g')!;
  const pulse = svg.querySelector<SVGCircleElement>('.cbg-track__pulse')!;

  let nodes: Element[] = [];
  let lens: number[] = [];
  let rows: [number, number][] = []; // each row's [start, end] length
  let total = 0;
  let phone = false;
  let panMax = 1; // the pan's full travel and the phone row's scroll range, px
  let swipeMax = 1;
  let drawn = -1;
  let m = 0; // first damped stage of the drawn length
  let v = 0; // second stage: what is drawn

  const draw = (len: number) => {
    if (Math.abs(len - drawn) < 0.05) return;
    drawn = len;
    line.style.strokeDashoffset = String(total + 1 - len);
    nodes.forEach((n, i) => n.classList.toggle('is-lit', len >= lens[i]! - 0.5));
  };

  // Node under each card. Offsets ignore the pan's transform and the reveal's lift (the track is the cards'
  // offsetParent and the gallery the track's, gold-track.css), so the SVG shares the track's own coordinates.
  const layout = () => {
    const lis = [...track.children] as HTMLElement[];
    if (!lis.length) return;
    const pts = lis.map((li) => ({
      x: track.offsetLeft + li.offsetLeft + li.offsetWidth / 2,
      y: track.offsetTop + li.offsetTop + li.offsetHeight + DROP,
    }));
    const pm = shareOf(lens, m);
    const pv = shareOf(lens, v);
    const parts = waveParts(pts);
    let d = '';
    lens = parts.map((part) => {
      d += part;
      guide.setAttribute('d', d);
      return guide.getTotalLength();
    });
    total = lens.at(-1)!;
    rows = [];
    parts.forEach((part, i) => (part[0] === 'M' ? rows.push([lens[i]!, lens[i]!]) : (rows.at(-1)![1] = lens[i]!)));
    line.setAttribute('d', d);
    line.style.strokeDasharray = `${total + 1} ${total + 1}`;
    if (nodes.length !== pts.length) {
      // Created once; a resize only moves them, so lit nodes stay lit.
      group.innerHTML = pts.map(() => '<g class="cbg-track__node"><circle class="cbg-track__halo" r="20" fill="url(#cbg-track-glow)"/><circle class="cbg-track__dot" r="3.5"/></g>').join('');
      nodes = [...group.children];
    }
    pts.forEach((p, i) => nodes[i]!.setAttribute('transform', `translate(${p.x} ${p.y})`));
    m = lengthAt(lens, pm);
    v = lengthAt(lens, pv);
    svg.setAttribute('width', String(track.offsetLeft + track.scrollWidth));
    svg.setAttribute('height', String(pts.at(-1)!.y + DROP));
    phone = getComputedStyle(gallery).overflowX === 'auto';
    panMax = Math.max(1, track.scrollWidth - track.clientWidth);
    swipeMax = Math.max(1, gallery.scrollWidth - gallery.clientWidth);
    drawn = -1; // new lengths: re-check which nodes are reached
    draw(reduced ? total : v);
  };

  // Also catches the pin switching the grid to one row, a late font and a resize (the gallery: the phone
  // row's scroll range changes with the screen even when the cards don't).
  const sizes = new ResizeObserver(layout);
  sizes.observe(track);
  sizes.observe(gallery);
  off.push(() => sizes.disconnect());
  layout();
  if (reduced) return () => off.forEach((f) => f());

  let seen = false;
  let shiftX = 0;
  let s = 0; // the pulse's position (length)
  let row = 0;
  let rest = 0;
  const tick = (_time: number, deltaMs: number) => {
    if (!lens.length) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const a = damp(dt, TAU);
    // Where the line should reach, as a share of the row: pinned pan, phone swipe, or a grid seen once. All
    // reads come before the one write (the SVG follows the pan), so a frame never forces a layout.
    const pan = section.classList.contains('is-pan');
    const x = pan ? (gsap.getProperty(track, 'x') as number) : 0;
    const p = pan ? -x / panMax : phone ? gallery.scrollLeft / swipeMax : seen ? 1 : 0;
    if (x !== shiftX) {
      shiftX = x;
      svg.style.transform = x ? `translate3d(${x}px,0,0)` : '';
    }
    // Two damped stages (a soft start and a soft stop) and a speed cap.
    m += (lengthAt(lens, p) - m) * a;
    v += Math.max(-MAX_SPEED * dt, Math.min(MAX_SPEED * dt, (m - v) * a));
    draw(v);

    // The pulse: one slow pass along the drawn part of a row, a rest, then the next row.
    const [a0, b0] = rows[row] ?? [0, 0];
    const end = Math.min(b0, v);
    s = Math.max(s, a0) + PULSE * dt;
    if (s > end || end - a0 < 120) {
      pulse.setAttribute('opacity', '0');
      if ((rest += dt) > 2.4) {
        rest = 0;
        row = (row + 1) % rows.length;
        s = rows[row]![0];
      }
      return;
    }
    const pt = guide.getPointAtLength(s);
    pulse.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
    pulse.setAttribute('opacity', (smooth(clamp01((s - a0) / 140)) * smooth(clamp01((end - s) / 140))).toFixed(3));
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
    svg.style.transform = '';
  });
  return () => off.forEach((f) => f());
}

// [data-cbg-gallery]: runs after gallery() (src/page-enhancers/home.ts). If the reduced-motion preference flips,
// matchMedia tears the track down and builds it again in the other mode.
export const goldTrack: Enhancer = (roots) => {
  const sections = all(roots, '[data-cbg-gallery]');
  if (!sections.length) return;
  const mm = gsap.matchMedia();
  mm.add({ reduced: reducedMotion, full: fullMotion }, (ctx) => {
    const undo = sections.map((s) => mount(s, !!ctx.conditions?.reduced));
    return () => undo.forEach((f) => f());
  });
  return () => mm.revert();
};
