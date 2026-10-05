// Cursor fx (desktop only). The native cursor stays; a soft circle trails it, shown only over the big text
// outside the hero and faded out everywhere else.
//   plain:     an off-white disc in difference blend, so it inverts whatever is under it.
//   blueprint: an engineer's loupe. Inside it a drafting sheet that sits fixed under the sky shows through
//              (screen blend, so white text stays white), with a soft edge and a thin gold rim.
// Over a link inside a region the disc/glass fades and only a small ring stays, so the link is never covered.
const REGIONS = [
  '#cbg-disciplines',
  '#cbg-how-it-works .cbg-section-head',
  '#cbg-courses .cbg-section-head',
  '#cbg-support h2', '#cbg-support .cbg-lead',
  '#cbg-about h2', '#cbg-about .cbg-about__body', '#cbg-about .cbg-link',
].join(',');

// The drafting sheet: a frame elevation with grid bubbles, a Warren truss, a floor plan with door swings,
// level marks, dimension strings and a title block. Lines blue, dimensions and notes gold.
const B = 'class="b"', G = 'class="g"';
const dim = (x1, y, x2, label) => `<g ${G}><path d="M${x1} ${y}H${x2}M${x1} ${y - 8}V${y + 8}M${x2} ${y - 8}V${y + 8}M${x1 - 5} ${y + 5}l10 -10M${x2 - 5} ${y + 5}l10 -10"/><text x="${(x1 + x2) / 2}" y="${y - 7}">${label}</text></g>`;
const bubble = (x, y, t) => `<g ${B}><circle cx="${x}" cy="${y}" r="13"/><text x="${x}" y="${y + 4}" class="t">${t}</text></g>`;
const level = (x, y, t) => `<g ${G}><path d="M${x} ${y}h140M${x + 10} ${y}l-7 -11h14z"/><text x="${x + 24}" y="${y - 6}" class="l">${t}</text></g>`;
const stair = `M140 500${'h40v-25'.repeat(8)}h120`;
const rebar = [0, 1, 2, 3, 4].map((i) => `<circle cx="${712 + i * 19}" cy="808" r="3"/>`).join('');
const SHEET = `<svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
<defs><pattern id="lab-cursor-x" width="240" height="240" patternUnits="userSpaceOnUse"><path ${G} d="M114 120h12M120 114v12"/></pattern></defs>
<rect width="1440" height="900" fill="url(#lab-cursor-x)"/>
<g ${B}>
  <path d="${stair}M140 520L460 320h120M140 500v20"/>
  <path class="d" d="M100 410h560"/>
  <path d="M730 100h120v14h-53v122h53v14h-120v-14h53v-122h-53z"/>
  <path class="d" d="M790 70v210M700 175h180"/>
  <path class="d" d="M630 720h250"/><path d="M700 760h100v60h-100zM735 760v-90M765 760v-90M640 735l15 -15M670 735l15 -15M820 735l15 -15M850 735l15 -15"/>${rebar}
  <path d="M960 700V280h330v420M960 595h330M960 490h330M960 385h330M1070 280v420M1180 280v420"/>
  <path class="d" d="M960 236v480M1070 236v480M1180 236v480M1290 236v480"/>
  <path d="M990 700v-70h50v70M1100 700v-70h50v70M1205 595v-65h60v65M990 490v-60h50v60M1100 385v-60h50v60M1205 385v-60h60v60"/>
  <path d="M930 700h390M930 704h390"/>
  <path d="M120 230h520M120 150h520M120 230l52 -80l52 80l52 -80l52 80l52 -80l52 80l52 -80l52 80l52 -80l52 80"/>
  <path d="M120 820V560h440v260zM120 690h180M300 560v260M300 690h260M430 690v130"/>
  <path class="d" d="M300 650a40 40 0 0 1 40 40M430 780a40 40 0 0 0 -40 -40M195 690a35 35 0 0 1 35 -35"/>
  <circle cx="740" cy="520" r="54"/><circle cx="740" cy="520" r="30"/>
  <path class="d" d="M670 520h140M740 450v140"/>
  <path d="M1140 760h200v80h-200zM1140 788h200M1240 788v52"/>
</g>
${bubble(960, 222, 'A')}${bubble(1070, 222, 'B')}${bubble(1180, 222, 'C')}${bubble(1290, 222, 'D')}
${dim(960, 742, 1070, '3 600')}${dim(1070, 742, 1180, '3 600')}${dim(1180, 742, 1290, '3 600')}
${dim(120, 120, 640, '10 400')}${dim(140, 545, 460, '8 × 250')}${dim(730, 290, 850, '190')}${dim(700, 850, 800, '1 200')}${dim(120, 850, 300, '3 600')}${dim(300, 850, 560, '5 200')}
${level(1310, 700, '±0.000')}${level(1310, 595, '+3.150')}${level(1310, 490, '+6.300')}${level(1310, 385, '+9.450')}
<g ${G}><text x="190" y="620" class="l">CLASSROOM</text><text x="370" y="630" class="l">OFFICE</text>
  <text x="740" y="610" class="l">DETAIL 1</text><text x="1150" y="779" class="l">CBG TRAINING INSTITUTE</text>
  <text x="1150" y="815" class="l">DWG 01</text><text x="1250" y="815" class="l">1:100</text>
  <path d="M660 470l-40 -40h-60"/><text x="560" y="424" class="l">BASE PLATE</text>
  <text x="480" y="300" class="l">STAIR SECTION A-A</text><text x="870" y="110" class="l">STEEL BEAM</text>
  <text x="820" y="790" class="l">PAD FOOTING</text></g>
</svg>`;

export default function mount(ctx) {
  if (!ctx.fine || ctx.reduced) return;
  const blue = ctx.state.theme === 'blueprint';
  const el = document.createElement('div');
  el.className = `lab-cursor lab-cursor--${blue ? 'blueprint' : 'plain'}`;
  el.setAttribute('aria-hidden', 'true');
  el.dataset.state = 'off';
  el.innerHTML = (blue ? `<div class="lab-cursor-glass"><div class="lab-cursor-sheet">${SHEET}</div></div>` : '<i class="lab-cursor-disc"></i>')
    + '<i class="lab-cursor-rim"></i><i class="lab-cursor-ring"></i>';
  document.body.appendChild(el);
  const sheet = el.querySelector('.lab-cursor-sheet');
  const R = el.offsetWidth / 2;
  const range = document.createRange();
  let tx = 0, ty = 0, x = 0, y = 0, last = 0, raf = 0, dirty = false, seen = false;

  // Which state the pointer is in: over a region's text (padded a little), over a link in it, or neither.
  function hit() {
    const t = document.elementFromPoint(tx, ty);
    const r = t?.closest(REGIONS);
    let on = !!r;
    if (r && r.id !== 'cbg-disciplines') {
      range.selectNodeContents(r);
      const b = range.getBoundingClientRect();
      on = tx > b.left - 32 && tx < b.right + 32 && ty > b.top - 32 && ty < b.bottom + 32;
    }
    el.dataset.state = !on ? 'off' : t.closest('a, button') ? 'link' : 'on';
  }

  // Heavy, frame-rate independent lerp (time constant ~240ms) with a speed cap, so it never darts.
  function tick(now) {
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
    last = now;
    if (dirty) { dirty = false; hit(); }
    const k = 1 - Math.exp(-dt * 4.2);
    let dx = (tx - x) * k, dy = (ty - y) * k;
    const d = Math.hypot(dx, dy), max = 1500 * dt;
    if (d > max && d) { dx *= max / d; dy *= max / d; }
    x += dx; y += dy;
    el.style.transform = `translate3d(${x - R}px,${y - R}px,0)`;
    if (sheet) sheet.style.transform = `translate3d(${R - x}px,${R - y}px,0)`;
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.2 ? requestAnimationFrame(tick) : 0;
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX; ty = e.clientY;
    if (!seen) { seen = true; x = tx; y = ty; }
    dirty = true; kick();
  }, { passive: true });
  addEventListener('scroll', () => { if (seen) { dirty = true; kick(); } }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { el.dataset.state = 'off'; });
}
