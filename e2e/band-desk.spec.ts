import { readFileSync, existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// The home band's floating desk (src/motion/band-desk.ts) on the home mock. Its photo and cut-outs are named
// on the Pages base; until deployed, this test serves them from dist/.
const TYPES: Record<string, string> = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', js: 'text/javascript', css: 'text/css', json: 'application/json' };

async function open(page: Page) {
  await page.route('https://mmmwolf45.github.io/cbg-lms-site/**', (r) => {
    const file = 'dist/' + new URL(r.request().url()).pathname.replace('/cbg-lms-site/', '');
    if (!existsSync(file)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ body: readFileSync(file), contentType: TYPES[file.split('.').pop()!] ?? 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/', { waitUntil: 'load' });
  if ((await page.locator('[data-cbg-desk]').count()) === 0) test.skip(true, 'band not built');
  await expect.poll(() => page.evaluate(() => (window as { __cbg?: number }).__cbg)).toBe(1);
  await page.locator('[data-cbg-desk]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
}
const transform = (page: Page, name: string) => page.locator(`.cbg-desk__obj--${name}`).evaluate((e) => (e as HTMLElement).style.transform);

test('laptop: an object lifts and turns as the cursor comes near, and glides back when it leaves', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  expect(await transform(page, 'laptop')).toBe(''); // still until reached for
  const b = (await page.locator('.cbg-desk__obj--laptop').boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.2, b.y + b.height / 2, { steps: 8 });
  await expect.poll(() => transform(page, 'laptop')).toMatch(/translate3d\([-\d.]+px, -\d[\d.]*px/); // lifted
  expect(await transform(page, 'helmet')).toBe(''); // the far object stays put
  await page.mouse.move(2, 2, { steps: 4 });
  await expect.poll(() => transform(page, 'laptop'), { timeout: 4000 }).toBe(''); // back at rest
  expect(errors).toEqual([]);
});

test('a click on an object turns it once and it comes to rest', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const b = (await page.locator('.cbg-desk__obj--helmet').boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await expect.poll(() => transform(page, 'helmet')).toMatch(/rotateY\((?!0\.00)/);
  await page.mouse.move(2, 2);
  await expect.poll(() => transform(page, 'helmet'), { timeout: 5000 }).toBe('');
});

test('reduced motion: the objects stay on the desk', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const b = (await page.locator('.cbg-desk__obj--laptop').boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
  await page.waitForTimeout(600);
  expect(await transform(page, 'laptop')).toBe('');
});
