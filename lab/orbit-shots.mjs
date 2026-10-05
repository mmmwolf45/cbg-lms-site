// Screenshots of the home band's orbiting site (src/motion/site-orbit.ts) on the mock (`npm run serve`):
// the start, middle and end of its sticky stretch at 1440x900 and 390x844, into lab/shots/orbit-*.png.
//   node lab/orbit-shots.mjs
import { readFileSync, existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

// The block names its assets on the Pages base; until they are deployed, serve them from dist/.
const TYPES = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', js: 'text/javascript', css: 'text/css', json: 'application/json', bin: 'application/octet-stream' };
export const localPages = (page) => page.route('https://mmmwolf45.github.io/cbg-lms-site/**', (r) => {
  const file = 'dist/' + new URL(r.request().url()).pathname.replace('/cbg-lms-site/', '');
  if (!existsSync(file)) return r.fulfill({ status: 404, body: '' });
  return r.fulfill({ body: readFileSync(file), contentType: TYPES[file.split('.').pop()] ?? 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } });
});

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [W, H] of [[1440, 900], [390, 844]]) {
  const phone = W < 600;
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: phone, isMobile: phone });
  await localPages(page);
  await page.goto('http://localhost:4173/');
  await page.waitForTimeout(2000);
  for (const [name, f] of [['start', 0], ['mid', 0.5], ['end', 1]]) {
    await page.evaluate(async (f) => {
      const pin = document.querySelector('.cbg-orbit'), stage = document.querySelector('.cbg-orbit__stage');
      const y = scrollY + pin.getBoundingClientRect().top - 56 + (pin.offsetHeight - stage.offsetHeight) * f;
      const y0 = scrollY;
      for (let k = 1; k <= 30; k++) { scrollTo(0, y0 + ((y - y0) * k) / 30); await new Promise((r) => requestAnimationFrame(r)); }
    }, f);
    await page.waitForTimeout(f === 0 ? 5000 : 3500);
    await page.screenshot({ path: `lab/shots/orbit-${name}-${W}.png` });
    console.log(W, name, await page.evaluate(() => document.querySelector('.cbg-orbit__canvas').dataset.frame));
  }
  await page.close();
}
await browser.close();
