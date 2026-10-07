import { expect, test } from '@playwright/test';
import { withoutSky } from './no-sky';

withoutSky();

// The 3D bow-tie, first in the course main block.
const COURSE = '/course/preview-101';

test('laptop: on a tilted plane, barriers standing off it, finished once centred; the mouse leans it slowly', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(COURSE);
  const fig = page.locator('[data-cbg-bowtie]');
  await fig.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  const barriers = page.locator('.cbg-bt-barrier');
  await expect(barriers).toHaveCount(6);
  for (const o of await barriers.evaluateAll((bs) => bs.map((b) => getComputedStyle(b).opacity))) expect(o).toBe('1');
  expect(await page.locator('.cbg-bowtie__stage').evaluate((e) => getComputedStyle(e).transform)).not.toBe('none');
  const box = (await fig.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5);
  await page.waitForTimeout(1800);
  const ry = await page.locator('.cbg-bowtie__tilt').evaluate((e) => Number(getComputedStyle(e).transform !== 'none'));
  expect(ry).toBe(1);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(2200);
  const m = await page.locator('.cbg-bowtie__tilt').evaluate((e) => new DOMMatrix(getComputedStyle(e).transform));
  expect(Math.abs(m.m13)).toBeLessThan(0.01); // back to flat (rotationY about 0)
});

test('reduced motion: the finished bow-tie, no tilt', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(COURSE);
  const fig = page.locator('[data-cbg-bowtie]');
  await fig.scrollIntoViewIfNeeded();
  for (const o of await page.locator('.cbg-bt-barrier').evaluateAll((bs) => bs.map((b) => getComputedStyle(b).opacity))) expect(o).toBe('1');
  const box = (await fig.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5);
  await page.waitForTimeout(800);
  expect(await page.locator('.cbg-bowtie__tilt').evaluate((e) => getComputedStyle(e).transform)).toBe('none');
});

test('phone: reads top to bottom, causes, the knot, then consequences; no tilt, no 3D', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(COURSE);
  await page.locator('[data-cbg-bowtie]').scrollIntoViewIfNeeded();
  const [l, k, r] = await Promise.all(['.cbg-bowtie__side--l', '.cbg-bowtie__knot', '.cbg-bowtie__side--r'].map((s) => page.locator(s).boundingBox()));
  expect(l!.y).toBeLessThan(k!.y);
  expect(k!.y).toBeLessThan(r!.y);
  expect(await page.locator('.cbg-bowtie__stage').evaluate((e) => getComputedStyle(e).transform)).toBe('none');
  await expect(page.locator('.cbg-bowtie__lines')).toBeHidden();
});
