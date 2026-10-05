// Support card fx (#cbg-support .cbg-plate).
//   Everywhere: a slow, faint gold light travels round the border (CSS only, support.css).
//   Desktop:    the photo layer tilts toward the pointer (5deg max, heavily damped, drifts back on leave); the
//               text and buttons stay flat, so they stay crisp and clickable. A soft gold spotlight trails the
//               cursor (blueprint: with a faint drafting grid inside it) and a faint diagonal glare drifts with it.
//   Reduced:    none of that; a still gold edge (support.css).
export default function mount(ctx) {
  const plate = document.querySelector('#cbg-support .cbg-plate');
  const bg = plate?.querySelector('.cbg-plate__bg');
  if (!bg) return;
  plate.classList.add('lab-support');
  plate.insertAdjacentHTML('beforeend', '<i class="lab-support-beam" aria-hidden="true"><i></i></i>');
  // the border light runs only while the card is on screen (support.css)
  new IntersectionObserver(([e]) => plate.classList.toggle('lab-support--on', e.isIntersecting)).observe(plate);
  if (!ctx.fine || ctx.reduced) return;

  plate.classList.add('lab-support--fine');
  const grid = ctx.state.theme === 'blueprint' ? '<i class="lab-support-grid"></i>' : '';
  bg.insertAdjacentHTML('afterend', `<i class="lab-support-spot" aria-hidden="true">${grid}</i><i class="lab-support-glare" aria-hidden="true"></i>`);
  const spot = plate.querySelector('.lab-support-spot');
  const glare = plate.querySelector('.lab-support-glare');
  const gridEl = spot.firstChild;
  const S = spot.offsetWidth / 2;

  let w = 1, h = 1, px = 0, py = 0, nx = 0.5, ny = 0.5, inside = false, last = 0, raf = 0, leftAt = -1e9;
  let x = 0, y = 0, tiltX = 0, tiltY = 0; // smoothed state

  function tick(now) {
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
    last = now;
    const kp = 1 - Math.exp(-dt * 3.2);              // spotlight: soft trail
    const kt = 1 - Math.exp(-dt * (inside ? 2 : 1.1)); // tilt: heavier still, and slower on the way back
    let dx = (px - x) * kp, dy = (py - y) * kp;
    const d = Math.hypot(dx, dy), max = 800 * dt; // speed cap, as cursor.js
    if (d > max) { dx *= max / d; dy *= max / d; }
    x += dx; y += dy;
    const ax = inside ? (0.5 - ny) * 8 : 0, ay = inside ? (nx - 0.5) * 10 : 0; // max 4deg / 5deg
    tiltX += (ax - tiltX) * kt; tiltY += (ay - tiltY) * kt;
    bg.style.transform = `rotateX(${tiltX.toFixed(3)}deg) rotateY(${tiltY.toFixed(3)}deg) scale(1.07)`;
    spot.style.transform = `translate3d(${x - S}px,${y - S}px,0)`;
    if (gridEl) gridEl.style.transform = `translate3d(${S - x}px,${S - y}px,0)`;
    glare.style.transform = `translate3d(${((x / w) - 0.5) * 30}%,0,0)`;
    const busy = Math.abs(px - x) + Math.abs(py - y) > 0.3 || Math.abs(ax - tiltX) + Math.abs(ay - tiltY) > 0.005;
    raf = busy ? requestAnimationFrame(tick) : 0;
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };

  function track(e) {
    const r = plate.getBoundingClientRect();
    w = r.width; h = r.height;
    px = e.clientX - r.left; py = e.clientY - r.top;
    nx = px / w; ny = py / h;
  }
  plate.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    track(e);
    // the light starts under the pointer, then trails it; if it is still fading out, it glides over instead
    if (!inside && performance.now() - leftAt > 1400) { x = px; y = py; }
    inside = true; plate.classList.add('is-lit'); kick();
  });
  plate.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { track(e); kick(); } }, { passive: true });
  plate.addEventListener('pointerleave', () => { inside = false; leftAt = performance.now(); plate.classList.remove('is-lit'); kick(); });
}
