// CPU profile while the 3D loads (scroll to just above the band), top self-time functions with call sites.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4173/');
await page.waitForTimeout(3000);
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
await cdp.send('Profiler.start');
await page.evaluate(() => { const r = document.querySelector('#cbg-band').getBoundingClientRect(); scrollTo(0, scrollY + r.top - innerHeight * 0.9); });
await page.waitForTimeout(10000);
const { profile } = await cdp.send('Profiler.stop');
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map(); profile.nodes.forEach((n) => (n.children || []).forEach((c) => parent.set(c, n.id)));
const name = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}:${n.callFrame.columnNumber}`;
const self = new Map(); const dt = profile.timeDeltas;
profile.samples.forEach((id, i) => {
  const n = byId.get(id); let chain = name(n); let p = parent.get(id); let k = 0;
  while (p && k < 6) { chain += ' <- ' + name(byId.get(p)); p = parent.get(p); k++; }
  self.set(chain, (self.get(chain) ?? 0) + (dt[i] ?? 0));
});
[...self.entries()].filter(([k]) => !k.startsWith('(idle)')).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, v]) => console.log((v / 1000).toFixed(0).padStart(6), 'ms', k));
await browser.close();
