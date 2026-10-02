import { expect, test } from '@playwright/test';

const htmlClass = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.className);

test('the loader injects the bundle and marks the route', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/course/preview-101');
  await expect(page.locator('script[src*="/cbg-lms-site/cbg."]')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __cbg?: number }).__cbg)).toBe(1);
  expect(await htmlClass(page)).toBe('cbg-js cbg-route-course');
  expect(errors).toEqual([]);
});

test('fails safe to stock course.link when the bundle is blocked', async ({ page }) => {
  await page.route('**/cbg-lms-site/cbg.*.js', (r) => r.abort());
  await page.goto('/');
  await expect.poll(() => htmlClass(page), { timeout: 6000 }).toBe('cbg-off');
  await expect(page.locator('#navbar')).toBeVisible();
});

test('fails safe when the manifest is unreachable', async ({ page }) => {
  await page.route('**/manifest.json*', (r) => r.abort());
  await page.goto('/');
  await expect.poll(() => htmlClass(page)).toBe('cbg-off');
});
