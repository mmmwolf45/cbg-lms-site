// T6: read-only probe of the live course.link site (findings: docs/platform-findings.md).
// A probe script is injected into this test browser's copy of each HTML page, in <head>, which is
// where the Custom Script slot puts our loader. Nothing on course.link is changed.
import { expect, test, type Page } from '@playwright/test';

const PROBE = `<script>document.documentElement.classList.add('cbg-probe');window.__loads=(window.__loads||0)+1</script>`;

const htmlClass = (page: Page) => page.evaluate(() => document.documentElement.className);
const loads = (page: Page) => page.evaluate(() => (window as unknown as { __loads: number }).__loads);

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()).replace(/<head([^>]*)>/, `<head$1>${PROBE}`) });
  });
});

test('a <head> script class survives hydration on home, live course and draft course', async ({ page }) => {
  for (const path of ['/', '/course/101-iosh-level3-certificate', '/course/preview-101']) {
    await page.goto(path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    expect(await htmlClass(page), path).toContain('cbg-probe');
  }
});

test('home -> course -> home -> Back all navigate client-side, so the loader runs once', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('a[href="/course/101-iosh-level3-certificate"]').first().click();
  await page.waitForURL(/\/course\//);
  await expect(page.locator('#course_content')).toHaveCount(1);
  await page.locator('#navbar a[href="/"]').first().click();
  await page.waitForURL((u) => u.pathname === '/');
  await page.goBack();
  await expect(page.locator('#course_content')).toHaveCount(1);
  expect(await loads(page)).toBe(1);
  expect(await htmlClass(page)).toContain('cbg-probe');
});
