// Scroll smoothness of the home page in a REAL Chrome window (headful, vsync-paced, the GPU the laptop uses),
// section by section, with a Chrome trace split into main thread / compositor / raster / GPU process time.
//   node lab/scroll-perf.mjs [--port 4173] [--dist dist] [--path /] [--cpu 1] [--off sky,cursor,...] [--label A] [--trace f.json]
// --path measures another mock page, e.g. --path /course/preview-101-risk-matrix (a course hero option).
// It drives the installed Google Chrome (channel 'chrome'; Playwright's own Chromium can't start a window on
// the Intel UHD laptop) at a 1440x900 viewport and the screen's real pixel ratio, waits for the page to settle,
// puts the mouse mid-screen and wheel-scrolls top to bottom at about 830 px/s (100 px notches every 120 ms),
// after one unmeasured warm-up pass (a fresh profile pays one-off shader compiles on its first scroll).
// Headless Chrome doesn't pace frames (rAF runs at 60 fps while the GPU falls behind), so its numbers lie.
// --off switches features off to bisect costs: sky (the whole background: waves and stars, one canvas since
// 6 Oct 2026) globe cursor support strip strip-anim blur shadow willchange anims hero band story stripmask masks.
// --idle rests at each section instead (--sections a,b,c; --rest ms at each, default 2000), --cold skips the warm-up pass, --fast skips the trace,
// --quads adds viz render-pass events to the trace, --css/--init add a style or a script. For A/B in one session
// (the GPU clock drifts with heat between runs) use lab/ab-perf.mjs.
// Output: one row per section: frames, frame-interval p50 / p95 / worst (ms), long tasks (count, ms), and busy ms
// per frame on the renderer main thread, the compositor, raster workers and the GPU process.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const PORT = arg('port', '4173'), DIST = arg('dist', 'dist'), CPU = Number(arg('cpu', '1'));
const OFF = new Set((arg('off', '') || '').split(',').filter(Boolean)), LABEL = arg('label', PORT), TRACE = arg('trace', '');
const WHEEL = Number(arg('wheel', '100')), EVERY = Number(arg('every', '120'));

const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1454,994', '--window-position=0,0'],
});
const page = await browser.newPage({ viewport: null });
await page.route('https://mmmwolf45.github.io/cbg-lms-site/**', (r) => {
  const file = join(DIST, new URL(r.request().url()).pathname.replace('/cbg-lms-site/', ''));
  if (!existsSync(file)) return r.fulfill({ status: 404, body: '' });
  const type = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', js: 'text/javascript', css: 'text/css', json: 'application/json' }[file.split('.').pop()];
  return r.fulfill({ body: readFileSync(file), contentType: type ?? 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } });
});

// Feature switches: a canvas whose context is refused never starts (sky, flow); the rest is CSS.
const CSS = {
  cursor: '.cbg-cursor{display:none!important}',
  support: '.cbg-plate__beam,.cbg-plate__spot,.cbg-plate__glare{display:none!important}.cbg-plate__bg{will-change:auto!important;transform:none!important}',
  strip: '.cbg-strip__n>span{-webkit-text-stroke:0!important;color:#59606e!important}.cbg-marquee__track{animation:none!important}',
  'strip-anim': '.cbg-marquee__track{animation:none!important}',
  globe: '.cbg-globe{display:none!important}',
  blur: '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
  shadow: '*{text-shadow:none!important}',
  willchange: '*{will-change:auto!important}',
  anims: '*,*::before,*::after{animation-play-state:paused!important}',
  hero: '.cbg-explode__canvas{display:none!important}',
  band: '[data-cbg-section="band"] canvas{display:none!important}',
  story: '.cbg-story__canvas{display:none!important}',
  stripmask: '.cbg-marquee{mask-image:none!important;-webkit-mask-image:none!important}',
  masks: '*{mask-image:none!important;-webkit-mask-image:none!important}',
};
const INIT = arg('init', ''), EXTRA = arg('css', '');
if (INIT) await page.addInitScript(INIT);
if (EXTRA) await page.addInitScript((c) => addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: c }))), EXTRA);
await page.addInitScript(([off, css]) => {
  const refuse = off.filter((k) => k === 'sky' || k === 'flow').map((k) => `cbg-${k}`);
  if (refuse.length) {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...a) { return refuse.some((c) => this.classList.contains(c)) ? null : get.apply(this, a); };
  }
  const rules = off.map((k) => css[k] ?? '').join('');
  if (rules) addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: rules })));
  // The recorder: every frame's time and the section at mid-screen (from bounds measured once, so it never
  // forces a layout), long tasks, and a user-timing mark at each section change (to slice the trace).
  const P = (window.__perf = { frames: [], long: [], on: false });
  new PerformanceObserver((l) => { if (P.on) for (const e of l.getEntries()) P.long.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: false });
  P.start = () => {
    const secs = [...document.querySelectorAll('[data-cbg-section]')].map((s) => {
      const box = (s.parentElement?.classList.contains('pin-spacer') ? s.parentElement : s).getBoundingClientRect();
      return [s.dataset.cbgSection, box.top + scrollY];
    }).sort((a, b) => a[1] - b[1]);
    P.secs = secs;
    let cur = '';
    P.on = true;
    const f = (t) => {
      const mid = scrollY + innerHeight / 2;
      let name = 'top';
      for (const [n, top] of secs) if (top <= mid) name = n;
      if (name !== cur) { cur = name; performance.mark(`sec:${name}`); }
      P.frames.push([t, name, scrollY]);
      if (P.on) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  };
}, [[...OFF], CSS]);

const cdp = await page.context().newCDPSession(page);
await page.goto(`http://localhost:${PORT}${arg('path', '/')}`);
await page.waitForTimeout(5000); // the sky arrives after load; the hero frames decode
const env = await page.evaluate(() => {
  const g = document.createElement('canvas').getContext('webgl'), x = g?.getExtension('WEBGL_debug_renderer_info');
  return { w: innerWidth, h: innerHeight, dpr: devicePixelRatio, gpu: x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : '?', height: document.documentElement.scrollHeight };
});
if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
await page.bringToFront();
await page.mouse.move(env.w / 2, env.h / 2);
// Scroll top to bottom with the wheel; returns when the page stops moving at the bottom.
const scrollDown = async () => {
  const t0 = Date.now();
  for (let stuck = 0; Date.now() - t0 < 120000 && stuck < 4;) {
    await page.mouse.wheel(0, WHEEL);
    await page.waitForTimeout(EVERY);
    const [y, max] = await page.evaluate(() => [scrollY, document.documentElement.scrollHeight - innerHeight]);
    stuck = y >= max - 2 ? stuck + 1 : 0;
  }
};
// A fresh profile has no GPU shader cache: the first pass pays one-off shader compiles and first rasters
// (tens to hundreds of ms a frame on the Intel UHD). Unless --cold, one unmeasured pass warms them up, so
// the measured pass shows what a returning visitor (or any later scroll) sees.
const COLD = process.argv.includes('--cold');
if (!COLD) {
  await scrollDown();
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(3000);
}
const SPLIT = !process.argv.includes('--fast');
if (SPLIT) await browser.startTracing(page, { categories: ['toplevel', 'gpu', 'viz', 'cc', 'blink.user_timing', 'disabled-by-default-devtools.timeline', 'devtools.timeline', ...(process.argv.includes('--quads') ? ['disabled-by-default-viz.quads'] : [])] });
await page.evaluate(() => window.__perf.start());
if (process.argv.includes('--idle')) {
  // At rest: the mouse still, each section centred for 2 s (what runs when nobody scrolls).
  for (const sec of arg('sections', 'hero,facts,disciplines,how-it-works,band,courses,support,about').split(',')) {
    await page.evaluate((sec) => { const el = document.querySelector(`[data-cbg-section="${sec}"]`); el && el.scrollIntoView({ block: 'center' }); }, sec);
    await page.waitForTimeout(Number(arg('rest', '2000')));
  }
} else await scrollDown();
const perf = await page.evaluate(() => { window.__perf.on = false; return { frames: window.__perf.frames, long: window.__perf.long, secs: window.__perf.secs }; });
const trace = SPLIT ? JSON.parse((await browser.stopTracing()).toString()) : { traceEvents: [] };
if (TRACE) writeFileSync(TRACE, JSON.stringify(trace));
await browser.close();

// Frame intervals per section (an interval belongs to the section shown when it ends).
const order = [], by = {};
for (let i = 1; i < perf.frames.length; i++) {
  const [t, s] = perf.frames[i];
  if (!by[s]) { by[s] = { gaps: [], long: 0, longMs: 0, t0: perf.frames[i - 1][0], t1: t }; order.push(s); }
  by[s].gaps.push(t - perf.frames[i - 1][0]);
  by[s].t1 = t;
}
for (const [st, d] of perf.long) for (const s of order) if (st >= by[s].t0 && st < by[s].t1) { by[s].long++; by[s].longMs += d; }

// Trace: thread busy time (merged top-level tasks) inside each section's window, from the sec: marks.
const ev = trace.traceEvents ?? trace;
const names = {}, procs = {};
for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') names[`${e.pid}:${e.tid}`] = e.args.name;
for (const e of ev) if (e.ph === 'M' && e.name === 'process_name') procs[e.pid] = e.args.name;
const marks = ev.filter((e) => e.name?.startsWith('sec:') && e.cat?.includes('user_timing')).sort((a, b) => a.ts - b.ts);
const rpid = marks[0]?.pid;
const group = (pid, tid) => {
  const n = names[`${pid}:${tid}`] ?? '';
  if (pid === rpid && n === 'CrRendererMain') return 'main';
  if (pid === rpid && n === 'Compositor') return 'comp';
  if (pid === rpid && n.startsWith('CompositorTileWorker')) return 'raster';
  if (/GPU/i.test(procs[pid] ?? '') && (n === 'CrGpuMain' || n === 'VizCompositorThread')) return 'gpu';
};
const busy = { main: [], comp: [], raster: [], gpu: [] };
for (const e of ev) {
  if (e.ph !== 'X' || !e.dur || !e.cat?.includes('toplevel')) continue;
  const g = group(e.pid, e.tid);
  if (g) busy[g].push([e.ts, e.ts + e.dur, `${e.pid}:${e.tid}`]);
}
const windows = {};
marks.forEach((m, i) => {
  const s = m.name.slice(4), end = marks[i + 1]?.ts ?? m.ts + 2e6;
  (windows[s] ??= []).push([m.ts, end]);
});
const busyIn = (g, wins) => {
  // per thread, merge overlaps (nested tasks), then clip to the windows
  const per = {};
  for (const [a, b, k] of busy[g]) (per[k] ??= []).push([a, b]);
  let sum = 0;
  for (const list of Object.values(per)) {
    list.sort((x, y) => x[0] - y[0]);
    let [ca, cb] = [-1, -1];
    const merged = [];
    for (const [a, b] of list) { if (a > cb) { if (cb > 0) merged.push([ca, cb]); ca = a; cb = b; } else cb = Math.max(cb, b); }
    if (cb > 0) merged.push([ca, cb]);
    for (const [a, b] of merged) for (const [wa, wb] of wins) sum += Math.max(0, Math.min(b, wb) - Math.max(a, wa));
  }
  return sum / 1000; // ms
};

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const r0 = (x) => Math.round(x);
console.log(`# ${LABEL} ${COLD ? "cold" : "warm"} cpu/${CPU} off=[${[...OFF]}] ${env.w}x${env.h}@${env.dpr} page ${env.height}px ${env.gpu}`);
console.log('section        frames  p50  p95 worst  long(ms)   main  comp raster  gpu  (ms/frame)');
const all = [];
for (const s of order) {
  const d = by[s], n = d.gaps.length, w = windows[s] ?? [];
  all.push(...d.gaps);
  const per = (g) => (busyIn(g, w) / n).toFixed(1).padStart(5);
  console.log(`${s.padEnd(14)} ${String(n).padStart(6)} ${String(r0(q(d.gaps, 0.5))).padStart(4)} ${String(r0(q(d.gaps, 0.95))).padStart(4)} ${String(r0(Math.max(...d.gaps))).padStart(5)}  ${String(d.long).padStart(2)} (${String(r0(d.longMs)).padStart(4)})  ${per('main')} ${per('comp')} ${per('raster')} ${per('gpu')}`);
}
console.log(`${'ALL'.padEnd(14)} ${String(all.length).padStart(6)} ${String(r0(q(all, 0.5))).padStart(4)} ${String(r0(q(all, 0.95))).padStart(4)} ${String(r0(Math.max(...all))).padStart(5)}`);
