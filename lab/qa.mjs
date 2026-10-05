// Lab QA: for each preset and width, scroll through the home page section by section, screenshot each,
// measure frame rate there, and collect console errors. Needs a lab server (npx tsx lab/serve.ts lab/out 4310).
//   node lab/qa.mjs [base=http://localhost:4310/] [presets=i1,i2] [widths=1440,390]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [base = 'http://localhost:4310/', presetArg = 'i1,i2', widthArg = '1440,390'] = process.argv.slice(2);
const SECTIONS = ['cbg-hero', 'cbg-disciplines', 'cbg-how-it-works', 'cbg-band', 'cbg-courses', 'cbg-support', 'cbg-about'];
mkdirSync('lab/shots/qa', { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = [];
for (const preset of presetArg.split(',')) {
  for (const w of widthArg.split(',').map(Number)) {
    const phone = w < 600;
    const page = await browser.newPage({ viewport: { width: w, height: phone ? 844 : 900 }, hasTouch: phone, isMobile: phone, deviceScaleFactor: 1 });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => { try { sessionStorage.setItem('lab-open', '0'); } catch {} });
    await page.goto(`${base}#${preset}`);
    await page.waitForTimeout(3500);
    for (const id of SECTIONS) {
      // Centre the section (the courses pin: go halfway into it), let scroll-linked fx settle, then measure.
      await page.evaluate((id) => {
        const el = document.getElementById(id);
        const r = el.getBoundingClientRect();
        const y = id === 'cbg-courses' ? r.top + scrollY + r.height * 0.45 : r.top + scrollY - Math.max(0, (innerHeight - r.height) / 2);
        scrollTo(0, y);
      }, id);
      await page.mouse.move(w * 0.3, 300);
      await page.waitForTimeout(400);
      await page.mouse.move(w * 0.6, 380, { steps: 12 });
      await page.waitForTimeout(2600);
      const fps = await page.evaluate(() => new Promise((done) => {
        let n = 0; const t0 = performance.now();
        (function f() { n++; performance.now() - t0 < 1500 ? requestAnimationFrame(f) : done(Math.round(n / 1.5)); })();
      }));
      await page.screenshot({ path: `lab/shots/qa/${preset}-${w}-${id}.png` });
      report.push(`${preset} ${w} ${id}: ${fps} fps`);
    }
    report.push(`${preset} ${w} errors: ${errors.length ? errors.join(' | ') : 'none'}`);
    await page.close();
  }
}
await browser.close();
console.log(report.join('\n'));
