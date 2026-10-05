// CPU profile of the story's chapter switches (after warm-up), top self-time functions.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4173/');
await page.waitForTimeout(2500);
const go = (f) => page.evaluate((f) => { const r = document.querySelector('#cbg-courses').getBoundingClientRect(); scrollTo(0, scrollY + r.top + f * (r.height - innerHeight)); }, f);
await go(0.01); await page.waitForTimeout(10000);
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start');
const longs = await page.evaluate(() => new Promise((done) => {
  const out = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => out.push(Math.round(e.duration)))).observe({ type: 'longtask' });
  const r = document.querySelector('#cbg-courses').getBoundingClientRect(); const top = scrollY + r.top, span = r.height - innerHeight;
  const t0 = performance.now();
  (function f(now) { const k = Math.min(1, (now - t0) / 8000); scrollTo(0, top + span * k); k < 1 ? requestAnimationFrame(f) : setTimeout(() => done(out), 300); })(t0);
}));
const { profile } = await cdp.send('Profiler.stop');
const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas; profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0)); });
console.log('long tasks (ms):', longs.join(', '));
[...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).forEach(([k, v]) => console.log((v / 1000).toFixed(0).padStart(6), 'ms', k));
await browser.close();
