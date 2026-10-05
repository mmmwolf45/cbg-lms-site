// Frame-rate probe: one section, several lab states, mouse moving over the section.
//   node lab/probe.mjs <section-id> <hash> [<hash>...]
import { chromium } from '@playwright/test';

const [id, ...hashes] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const hash of hashes) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => { try { sessionStorage.setItem('lab-open', '0'); } catch {} });
  await page.goto(`http://localhost:4310/#${hash}`);
  await page.waitForTimeout(3000);
  await page.evaluate((id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    scrollTo(0, r.top + scrollY - Math.max(0, (innerHeight - r.height) / 2));
  }, id);
  await page.waitForTimeout(1500);
  const box = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
  const move = (async () => { for (let i = 0; i < 30; i++) await page.mouse.move(box.x - 300 + i * 20, box.y, { steps: 2 }); })();
  const fps = await page.evaluate(() => new Promise((done) => {
    let n = 0; const t0 = performance.now();
    (function f() { n++; performance.now() - t0 < 2000 ? requestAnimationFrame(f) : done(Math.round(n / 2)); })();
  }));
  await move;
  console.log(`${id} ${hash}: ${fps} fps`);
  await page.close();
}
await browser.close();
