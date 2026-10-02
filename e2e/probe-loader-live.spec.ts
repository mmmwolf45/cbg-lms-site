// Read-only: is the pasted loader working on the live site? Run after any change to the Custom Script.
import { expect, test } from '@playwright/test';

const htmlClass = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.className);

test('live loader: noindex, bundle loaded, route classes follow client-side navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  await expect(page.locator('script[src*="mmmwolf45.github.io/cbg-lms-site/cbg."]')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __cbg?: number }).__cbg)).toBe(1);
  expect(await htmlClass(page)).toContain('cbg-route-home');

  await page.locator('a[href="/course/101-iosh-level3-certificate"]').first().click();
  await page.waitForURL(/\/course\//);
  await expect.poll(() => htmlClass(page)).toContain('cbg-route-course');
  expect(await htmlClass(page)).not.toContain('cbg-off');
  expect(errors).toEqual([]);
});
