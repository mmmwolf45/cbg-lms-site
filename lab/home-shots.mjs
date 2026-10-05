// Screenshots of the real home page (mock course.link, `npm run serve`) through the 3D band and the course
// story, on the machine's GPU. node lab/home-shots.mjs [width=1440] [height=900] [base=http://localhost:4173/]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [w = '1440', h = '900', base = 'http://localhost:4173/'] = process.argv.slice(2);
const W = Number(w), H = Number(h), phone = W < 600;
mkdirSync('lab/shots/home', { recursive: true });
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: phone, isMobile: phone });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(base);
await page.waitForTimeout(3000);
const at = async (sel, f) => page.evaluate(([sel, f]) => {
  const el = document.querySelector(sel);
  const r = el.getBoundingClientRect();
  scrollTo(0, scrollY + r.top + f * Math.max(0, r.height - innerHeight));
}, [sel, f]);
// Scroll there in small steps (the 3D follows scroll events), then let the damping settle.
const go = async (sel, f, name) => {
  const target = await page.evaluate(([sel, f]) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return scrollY + r.top + f * Math.max(0, r.height - innerHeight);
  }, [sel, f]);
  for (let i = 0; i < 12; i++) {
    await page.evaluate(([t, i]) => scrollTo(0, scrollY + (t - scrollY) * (i + 1) / 12), [target, i]);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `lab/shots/home/${W}-${name}.png` });
};
void at;
for (const f of [0.05, 0.35, 0.7]) await go('#cbg-band', f, `band-${f}`);
const n = await page.evaluate(() => document.querySelectorAll('#cbg-courses [data-scene]').length);
for (let i = 0; i < n; i++) await go('#cbg-courses', (i + 0.5) / n, `story-${i}`);
const state = await page.evaluate(() => ({
  band3d: document.querySelector('#cbg-band')?.classList.contains('is-3d'),
  story: document.querySelector('#cbg-courses')?.classList.contains('is-story'),
  chunks: performance.getEntriesByType('resource').map((e) => e.name.split('/').pop()).filter((n) => n.includes('three') || n.endsWith('.glb')),
}));
console.log(JSON.stringify(state), '\nerrors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
