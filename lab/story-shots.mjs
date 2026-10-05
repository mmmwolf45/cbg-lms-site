// Screenshots of the courses story (src/motion/course-story.ts) on the mock (`npm run serve`): the middle of
// chapters 0 and 1 at 1440x900 and 390x844, into lab/shots/story-<chapter>-<width>.png.
//   node lab/story-shots.mjs
import { readFileSync, existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const TYPES = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', js: 'text/javascript', css: 'text/css', json: 'application/json' };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [W, H] of [[1440, 900], [390, 844]]) {
  const phone = W < 600;
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: phone, isMobile: phone });
  // The block names its assets on the Pages base; until they are deployed, serve them from dist/.
  await page.route('https://mmmwolf45.github.io/cbg-lms-site/**', (r) => {
    const file = 'dist/' + new URL(r.request().url()).pathname.replace('/cbg-lms-site/', '');
    if (!existsSync(file)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ body: readFileSync(file), contentType: TYPES[file.split('.').pop()] ?? 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } });
  });
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && console.log('console:', m.text()));
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto('http://localhost:4173/');
  await page.waitForTimeout(2000);
  for (const k of [0, 1]) {
    await page.evaluate(async (k) => {
      const s = document.querySelector('[data-cbg-story]'), w = s.querySelector('.cbg-wrap');
      const n = s.querySelectorAll('.cbg-gallery__track > li').length;
      const y = scrollY + s.getBoundingClientRect().top - 56 + ((k + 0.5) / n) * (s.offsetHeight - w.offsetHeight);
      const y0 = scrollY;
      for (let i = 1; i <= 30; i++) { scrollTo(0, y0 + ((y - y0) * i) / 30); await new Promise((r) => requestAnimationFrame(r)); }
    }, k);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `lab/shots/story-${k}-${W}.png` });
    console.log(W, k, await page.evaluate(() => {
      const c = document.querySelector('.cbg-story__canvas');
      return { story: document.querySelector('[data-cbg-story]').classList.contains('is-story'), chapter: c.dataset.chapter, frame: c.dataset.frame, on: c.classList.contains('is-on'), size: c.width };
    }));
  }
  await page.close();
}
await browser.close();
