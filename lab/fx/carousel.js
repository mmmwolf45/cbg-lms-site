// Gold constellation track under the course cards (lab prototype, lab/README.md).
// One SVG behind the row: a faint guide path through a node under each card, a gold copy of it that draws
// in with the row's progress (pinned pan: the track's x; phones: scrollLeft; grid: once in view), nodes that
// light as the line reaches them and a soft pulse drifting along the drawn part. Blueprint adds a faint grid.
// Live cards get a slow border beam on hover/focus (CSS only, carousel.css).
const NS = 'http://www.w3.org/2000/svg';
const DROP = 22;     // node centre below the card's bottom edge (the track gets 44px of room, carousel.css)
const WAVE = 6;      // the line sags this far up/down between nodes
const PULSE = 64;    // px/s
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export default function mount(ctx) {
  const gallery = document.querySelector('#cbg-courses .cbg-gallery');
  const track = gallery?.querySelector('.cbg-gallery__track');
  if (!track) return;
  const section = gallery.closest('section');
  const blueprint = ctx.state.theme === 'blueprint';

  for (const card of document.querySelectorAll('#cbg-courses .cbg-course--live')) {
    card.insertAdjacentHTML('beforeend', '<span class="lab-carousel-beam" aria-hidden="true"></span>');
  }

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'lab-carousel-sky');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = `<defs>
<radialGradient id="lab-carousel-glow"><stop offset="0" stop-color="#D6B160" stop-opacity=".55"/><stop offset=".45" stop-color="#D6B160" stop-opacity=".16"/><stop offset="1" stop-color="#D6B160" stop-opacity="0"/></radialGradient>
${blueprint ? `<pattern id="lab-carousel-cell" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 .5H.5V28" fill="none" stroke="rgba(150,180,235,.045)"/></pattern>
<pattern id="lab-carousel-major" width="112" height="112" patternUnits="userSpaceOnUse"><rect width="112" height="112" fill="url(#lab-carousel-cell)"/><path d="M112 .5H.5V112" fill="none" stroke="rgba(150,180,235,.08)"/></pattern>
<linearGradient id="lab-carousel-fade" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".25" stop-color="#fff" stop-opacity=".45"/><stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="lab-carousel-mask" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#lab-carousel-fade)"/></mask>` : ''}
</defs>${blueprint ? '<rect class="lab-carousel-grid" fill="url(#lab-carousel-major)" mask="url(#lab-carousel-mask)"/>' : ''}
<path class="lab-carousel-guide"/><path class="lab-carousel-line"/><g></g>
<circle class="lab-carousel-pulse" r="16" fill="url(#lab-carousel-glow)" opacity="0"/>`;
  gallery.prepend(svg);
  const guide = svg.querySelector('.lab-carousel-guide'), line = svg.querySelector('.lab-carousel-line');
  const group = svg.querySelector('g');
  const pulse = svg.querySelector('.lab-carousel-pulse');
  const grid = svg.querySelector('.lab-carousel-grid');
  const glyph = blueprint
    ? '<path class="lab-carousel-star" d="M0-8Q1.4-1.4 8 0Q1.4 1.4 0 8Q-1.4 1.4-8 0Q-1.4-1.4 0-8Z"/>'
    : '<circle class="lab-carousel-star" r="3.5"/>';

  let nodes = [], lens = [], rows = [], total = 0, phone = false, drawn = -1;
  let m = 0, v = 0; // the drawn length, two damped stages (tick)

  // Length <-> fractional node index, so a resize keeps the same nodes lit.
  const at = (p) => {
    const f = Math.min(1, Math.max(0, p)) * (lens.length - 1), i = Math.floor(f), j = Math.min(i + 1, lens.length - 1);
    return lens[i] + (lens[j] - lens[i]) * (f - i);
  };
  const share = (len) => {
    let i = 0;
    while (i < lens.length - 2 && lens[i + 1] <= len) i++;
    const span = (lens[i + 1] ?? lens[i]) - lens[i];
    return (i + (span ? Math.min(1, Math.max(0, (len - lens[i]) / span)) : 0)) / Math.max(1, lens.length - 1);
  };

  // Node under each card (offsets ignore the pan's transform and the reveal's lift), one wave per row.
  function layout() {
    const lis = [...track.children];
    if (!lis.length) return;
    const pts = lis.map((li) => ({
      x: track.offsetLeft + li.offsetLeft + li.offsetWidth / 2,
      y: track.offsetTop + li.offsetTop + li.offsetHeight + DROP,
    }));
    const pm = lens.length ? share(m) : 0, pv = lens.length ? share(v) : 0;
    let d = '', s = 1;
    const parts = pts.map((p, i) => {
      const prev = pts[i - 1];
      if (!prev || Math.abs(prev.y - p.y) > 4) { s = 1; return `M${p.x} ${p.y}`; }
      const k = (p.x - prev.x) * 0.4, part = `C${prev.x + k} ${prev.y + s * WAVE} ${p.x - k} ${p.y + s * WAVE} ${p.x} ${p.y}`;
      s = -s;
      return part;
    });
    lens = parts.map((part) => { d += part; guide.setAttribute('d', d); return guide.getTotalLength(); });
    total = lens.at(-1);
    rows = [];
    parts.forEach((part, i) => (part[0] === 'M' ? rows.push([lens[i], lens[i]]) : (rows.at(-1)[1] = lens[i])));
    line.setAttribute('d', d);
    line.style.strokeDasharray = `${total + 1} ${total + 1}`;
    if (nodes.length !== pts.length) { // created once; a resize only moves them, so lit nodes stay lit
      group.innerHTML = pts.map(() => `<g><circle class="lab-carousel-halo" r="20" fill="url(#lab-carousel-glow)"/>${glyph}</g>`).join('');
      nodes = [...group.children];
    }
    pts.forEach((p, i) => nodes[i].setAttribute('transform', `translate(${p.x} ${p.y})`));
    m = at(pm); v = at(pv);
    const w = track.offsetLeft + track.scrollWidth, h = pts.at(-1).y + DROP;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    if (grid) for (const [k, v] of Object.entries({ x: -240, y: -48, width: w + 480, height: h + 72 })) grid.setAttribute(k, v);
    phone = getComputedStyle(gallery).overflowX === 'auto';
    drawn = -1; // new lengths: re-check which nodes are reached
    draw(ctx.reduced ? total : v);
  }
  function draw(len) {
    if (Math.abs(len - drawn) < 0.05) return;
    drawn = len;
    line.style.strokeDashoffset = total + 1 - len;
    nodes.forEach((n, i) => n.classList.toggle('is-lit', len >= lens[i] - 0.5));
  }

  new ResizeObserver(layout).observe(track); // also catches the pin switching the grid to one row
  layout();
  if (ctx.reduced) return;

  // Where the line should reach: a fractional node index from the row's progress, as a length (at).
  let seen = false, s = 0, row = 0, rest = 0;
  function tick(_, dtMs) {
    if (!lens.length) return; // empty track: nothing to draw
    const dt = Math.min(dtMs, 50) / 1000, a = 1 - Math.exp(-dt / 0.3);
    const pan = section.classList.contains('is-pan');
    const x = pan ? new DOMMatrixReadOnly(track.style.transform || 'none').m41 : 0;
    svg.style.transform = x ? `translate3d(${x}px,0,0)` : '';
    let target;
    if (pan) target = at(-x / Math.max(1, track.scrollWidth - track.clientWidth));
    else if (phone) target = at(gallery.scrollLeft / Math.max(1, gallery.scrollWidth - gallery.clientWidth));
    else target = seen ? total : 0;
    // Two damped stages (soft start and soft stop) with a speed cap, so even a fast scroll draws calmly.
    m += (target - m) * a;
    v += Math.max(-700 * dt, Math.min(700 * dt, (m - v) * a));
    draw(v);

    // The pulse: one slow pass along the drawn part of a row, a rest, then the next row.
    const [a0, b0] = rows[row] ?? [0, 0], end = Math.min(b0, v);
    if (s < a0) s = a0;
    s += PULSE * dt;
    if (s > end || end - a0 < 120) {
      pulse.setAttribute('opacity', 0);
      if ((rest += dt) > 2.4) { rest = 0; row = (row + 1) % rows.length; s = rows[row][0]; }
      return;
    }
    const p = guide.getPointAtLength(s);
    pulse.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    pulse.setAttribute('opacity', (smooth((s - a0) / 140) * smooth((end - s) / 140)).toFixed(3));
  }

  let on = false;
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) seen = true;
    if (e.isIntersecting === on) return;
    on = e.isIntersecting;
    on ? ctx.gsap.ticker.add(tick) : ctx.gsap.ticker.remove(tick);
  }, { rootMargin: '0px 0px -15% 0px' }).observe(gallery);
}
