// logo=coin: the CBG circle as a thick gold-rimmed medallion in CSS 3D. Desktop: it turns toward the cursor
// anywhere over the About section, through a two-stage smoothing (slow start, slow stop, no overshoot), on top of a
// slow idle sway. Click or tap: one slow full turn. Phones: sway + tap. Reduced motion: still, slightly angled.
const EDGE = 48; // reeded edge segments

export default function mount(ctx) {
  const about = document.getElementById('cbg-about');
  const panel = about?.querySelector('.cbg-logos');
  if (!panel?.querySelector('.cbg-logo')) return;

  const ring = 'CBG · TRAINING INSTITUTE · CBG · TRAINING INSTITUTE · ';
  const edge = Array.from({ length: EDGE }, (_, i) => `<i style="--a:${(i * 360) / EDGE}deg"></i>`).join('');
  const stage = document.createElement('div');
  stage.className = 'lab-logo-coin-stage';
  stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML = `<div class="lab-logo-coin">
<div class="lab-logo-coin-face lab-logo-coin-front"><img src="${ctx.site('brand/cbg-mark-900.webp')}" alt="" decoding="async"><span class="lab-logo-coin-sheen"></span></div>
<div class="lab-logo-coin-face lab-logo-coin-back"><svg viewBox="0 0 200 200"><defs><path id="lab-logo-coin-p" d="M100 100m-74 0a74 74 0 1 1 148 0a74 74 0 1 1-148 0"/></defs>
<circle cx="100" cy="100" r="88" class="lab-logo-coin-groove"/><circle cx="100" cy="100" r="60" class="lab-logo-coin-groove"/>
<text class="lab-logo-coin-ring"><textPath href="#lab-logo-coin-p" textLength="462">${ring}</textPath></text>
<text x="100" y="114" text-anchor="middle" class="lab-logo-coin-mono">CBG</text></svg><span class="lab-logo-coin-sheen"></span></div>
<div class="lab-logo-coin-edge">${edge}</div></div><div class="lab-logo-coin-shadow"></div>`;
  panel.classList.add('lab-logo-coin-panel');
  panel.prepend(stage);
  const coin = stage.querySelector('.lab-logo-coin');

  const L = [-0.5, -0.5, 0.71]; // light: upper left, in front
  const rad = Math.PI / 180;
  const draw = (rx, ry) => {
    const sy = Math.sin(ry * rad), cy = Math.cos(ry * rad), sx = Math.sin(rx * rad), cx = Math.cos(rx * rad);
    // front normal (0,0,1) after rotateX(rx) rotateY(ry): (sy, -cy*sx, cy*cx)
    const lf = L[0] * sy - L[1] * cy * sx + L[2] * cy * cx;
    const s = coin.style;
    s.transform = `rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;
    s.setProperty('--ry', ry.toFixed(2));
    s.setProperty('--lf', lf.toFixed(3));
    s.setProperty('--gx', sy.toFixed(3));
    s.setProperty('--gy', sx.toFixed(3));
  };

  if (ctx.reduced) { draw(9, -24); return; }

  // ---- motion ----
  let tx = 0, ty = 0;           // pointer target (deg)
  let mx = 0, my = 0, rx = 0, ry = 0; // two smoothing stages
  const turn = { a: 0 };        // click turn, added to ry
  let turning = null;

  if (ctx.fine) {
    about.addEventListener('pointermove', (e) => {
      const r = about.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      ty = Math.max(-1, Math.min(1, nx)) * 34;
      tx = Math.max(-1, Math.min(1, ny)) * -18;
    });
    about.addEventListener('pointerleave', () => { tx = ty = 0; });
  }
  coin.addEventListener('click', () => {
    if (turning?.isActive()) return;
    turning = ctx.gsap.to(turn, { a: turn.a + 360, duration: 5.5, ease: 'sine.inOut' });
  });

  let raf = 0, last = 0, onScreen = false;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const t = now / 1000;
    const k = 1 - Math.exp(-dt / 0.55); // each stage ~0.55 s; together a slow S-curve
    mx += (tx + Math.sin(t * 0.47) * 3.5 - mx) * k;   // idle sway: ~13 s and ~17 s periods
    my += (ty + Math.sin(t * 0.37 + 1) * 7 - my) * k;
    rx += (mx - rx) * k;
    ry += (my - ry) * k;
    draw(rx, ry + turn.a);
    raf = requestAnimationFrame(frame);
  };
  const run = () => {
    const go = onScreen && !document.hidden;
    if (go && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    if (!go && raf) { cancelAnimationFrame(raf); raf = 0; }
  };
  draw(0, 0);
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; run(); }).observe(panel);
  document.addEventListener('visibilitychange', run);
}
