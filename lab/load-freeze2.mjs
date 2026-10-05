// Long tasks while the 3D loads: scroll to just above the band, then record for 10 s.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
if (process.env.LOW) await page.addInitScript(() => Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 }));
await page.goto('http://localhost:4173/');
await page.waitForTimeout(3000);
const longs = await page.evaluate(() => new Promise((done) => {
  const out = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => out.push(Math.round(e.duration)))).observe({ type: 'longtask' });
  const r = document.querySelector('#cbg-band').getBoundingClientRect();
  scrollTo(0, scrollY + r.top - innerHeight * 0.9);
  setTimeout(() => done(out), 10000);
}));
console.log('long tasks (ms):', longs.join(', ') || 'none', ' total', longs.reduce((a, b) => a + b, 0));
await browser.close();
