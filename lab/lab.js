// Night-sky lab: a switcher over the real home page. State lives in the URL hash
// (#theme=blueprint&sky=waves&band=constellation&logo=globe); changing anything reloads the page with the new
// hash and keeps the scroll position, so fx modules never need to tear themselves down.
// Each fx module is lab/fx/<name>.js with `export default function mount(ctx)`; lab/fx/<name>.css, when it
// exists, is linked before the module loads. Contract: lab/README.md.

const OPTIONS = {
  theme: [['blueprint', 'Stars over blueprints'], ['plain', 'Night sky, plain'], ['current', 'Today']],
  sky: [['waves', 'Stars over waves'], ['pure', 'Pure sky'], ['current', 'Today']],
  band: [['constellation', 'A. Constellation'], ['gravity', 'B. Zero gravity'], ['silk', 'C. Silk'], ['scrub', 'D. Film scrub'], ['current', 'Today']],
  logo: [['globe', 'Globe'], ['coin', 'Coin'], ['current', 'Today']],
};
const LABELS = { theme: 'Theme', sky: 'Sky', band: 'Band', logo: 'Logo' };
const PRESETS = [
  ['Iteration 1', { theme: 'blueprint', sky: 'waves', band: 'constellation', logo: 'globe' }],
  ['Iteration 2', { theme: 'plain', sky: 'pure', band: 'gravity', logo: 'coin' }],
  ['Today’s site', { theme: 'current', sky: 'current', band: 'current', logo: 'current' }],
];
const DEFAULT = PRESETS[0][1];

const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* private mode: fine */ } },
};

// The hash carries the state locally; an Artifact's frame may drop key=value hashes, so the last choice is
// also kept in sessionStorage, and the bare tokens #i1, #i2 and #today pick a preset.
function readState() {
  const bare = { i1: 0, i2: 1, today: 2 }[location.hash.slice(1)];
  if (bare !== undefined) return { ...PRESETS[bare][1] };
  const raw = location.hash.includes('=') ? location.hash.slice(1) : store.get('lab-state') || '';
  const p = new URLSearchParams(raw);
  const s = {};
  for (const k of Object.keys(OPTIONS)) {
    const v = p.get(k);
    s[k] = OPTIONS[k].some(([id]) => id === v) ? v : DEFAULT[k];
  }
  return s;
}

const hashOf = (s) => Object.keys(OPTIONS).map((k) => `${k}=${s[k]}`).join('&');

function go(next) {
  store.set('lab-scroll', String(scrollY));
  store.set('lab-state', hashOf(next));
  const base = String(window.__labHref || location.href).split('#')[0];
  const hash = hashOf(next);
  if (base === location.href.split('#')[0]) { location.hash = hash; location.reload(); }
  else location.replace(`${base}#${hash}`);
}

const state = readState();
const html = document.documentElement;
for (const k of Object.keys(state)) html.dataset[`lab${k[0].toUpperCase()}${k.slice(1)}`] = state[k];

// ---- switcher panel ----
function panel() {
  const el = document.createElement('div');
  el.className = 'lab-panel';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Prototype switcher');
  const saved = store.get('lab-open');
  const open = saved ? saved !== '0' : innerWidth > 600; // starts folded on phones
  el.dataset.open = String(open);
  const rows = Object.keys(OPTIONS).map((k) => `<div class="lab-row"><span class="lab-key">${LABELS[k]}</span><div class="lab-seg">${
    OPTIONS[k].map(([id, label]) => `<button type="button" data-k="${k}" data-v="${id}" aria-pressed="${state[k] === id}">${label}</button>`).join('')
  }</div></div>`).join('');
  const presets = PRESETS.map(([label, s], i) => `<button type="button" data-preset="${i}" aria-pressed="${hashOf(s) === hashOf(state)}">${label}</button>`).join('');
  el.innerHTML = `<button type="button" class="lab-toggle" aria-expanded="${open}">Lab</button>
<div class="lab-body"><div class="lab-presets">${presets}</div>${rows}
<p class="lab-note">Each change reloads at the same scroll position.</p></div>`;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('lab-toggle')) {
      const o = el.dataset.open !== 'true';
      el.dataset.open = String(o);
      b.setAttribute('aria-expanded', String(o));
      store.set('lab-open', o ? '1' : '0');
    } else if (b.dataset.preset) go(PRESETS[Number(b.dataset.preset)][1]);
    else if (b.dataset.k && state[b.dataset.k] !== b.dataset.v) go({ ...state, [b.dataset.k]: b.dataset.v });
  });
  document.body.appendChild(el);
}

// ---- fx mounting ----
function wanted(s) {
  const list = [];
  if (s.sky !== 'current') list.push('sky');
  if (s.theme !== 'current') list.push('strip', 'carousel', 'support', 'cursor');
  if (s.band !== 'current') list.push(`band-${s.band}`);
  if (s.logo !== 'current') list.push(`logo-${s.logo}`);
  return list;
}

const linkCss = (name) => new Promise((done) => {
  if (!(window.__labCss || []).includes(name)) return done();
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `./fx/${name}.css`;
  l.onload = l.onerror = done;
  document.head.appendChild(l);
});

const ctx = {
  state,
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  fine: matchMedia('(hover: hover) and (pointer: fine)').matches,
  gsap: null, // set in start(), after the bundle: see loadScript
  ScrollTrigger: null,
  asset: (p) => `./assets/${p}`,
  site: (p) => `./site/${p}`,
};
window.__lab = ctx;

// The real bundle sets window.__cbg once it has started; fx modules run after it so they can build on its DOM.
const bundleReady = () => new Promise((done) => {
  const t0 = performance.now();
  (function wait() { (window.__cbg || performance.now() - t0 > 6000) ? done() : setTimeout(wait, 50); })();
});

// The lab's own GSAP (a global) must arrive after the bundle has started: GSAP plugins adopt window.gsap
// when they initialise, so an earlier global would steal the bundle's ScrollTrigger.
const loadScript = (src) => new Promise((done) => {
  const s = document.createElement('script');
  s.src = src;
  s.onload = s.onerror = done;
  document.head.appendChild(s);
});

async function start() {
  panel();
  await bundleReady();
  await loadScript('./vendor/gsap.min.js');
  await loadScript('./vendor/ScrollTrigger.min.js');
  ctx.gsap = window.gsap;
  ctx.ScrollTrigger = window.ScrollTrigger;
  if (ctx.gsap && ctx.ScrollTrigger) ctx.gsap.registerPlugin(ctx.ScrollTrigger);
  for (const name of wanted(state)) {
    try {
      await linkCss(name);
      const mod = await import(`./fx/${name}.js`);
      mod.default(ctx);
    } catch (err) {
      console.warn(`[lab] ${name} failed`, err);
    }
  }
  const y = Number(store.get('lab-scroll'));
  if (y) { store.set('lab-scroll', ''); requestAnimationFrame(() => scrollTo(0, y)); }
  ctx.ScrollTrigger?.refresh();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
