// T17 / T26: the quality matrix for every page we build, on the local course.link mock.
// Widths from SPEC section 8. Each page: sections visible, no console errors, axe (serious/critical),
// CLS, reduced motion, and the fail-safe with our bundle blocked.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const WIDTHS = [1440, 1024, 768, 390];
const PAGES = [
  { name: 'home', path: '/', root: '[data-cbg="home"]' },
  { name: 'course', path: '/course/preview-101', root: '[data-cbg$="-top"]' },
];

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 500) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(800);
}

for (const p of PAGES) {
  test.describe(p.name, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(p.path);
      test.skip((await page.locator(p.root).count()) === 0, `${p.name} block not built yet`);
    });

    for (const width of WIDTHS) {
      test(`${width}px: sections visible, no errors, no serious axe issues`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
        await page.setViewportSize({ width, height: 900 });
        await page.goto(p.path, { waitUntil: 'networkidle' });
        await scrollThrough(page);

        for (const section of await page.locator('[data-cbg] [data-cbg-section]').all()) {
          await expect(section).toBeVisible();
        }
        const hidden = await page.$$eval('[data-cbg-reveal]', (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length);
        expect(hidden, 'every reveal finished').toBe(0);

        // Only our blocks: course.link's own markup is not ours to fix.
        const axe = await new AxeBuilder({ page }).include('[data-cbg]').analyze();
        const bad = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target}`)).toEqual([]);
        expect(errors).toEqual([]);
      });
    }

    test('no layout shift from our blocks while loading (CLS < 0.05)', async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
            if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(p.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
    });

    test('reduced motion: everything visible without scrolling, no pinning', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(p.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const hidden = await page.$$eval('[data-cbg-reveal], [data-cbg-reveal] > *', (els) =>
        els.filter((e) => getComputedStyle(e).opacity !== '1').length);
      expect(hidden).toBe(0);
      expect(await page.locator('.pin-spacer').count()).toBe(0);
    });

    test('bundle blocked: the block still reads in its final state', async ({ page }) => {
      await page.route('**/cbg-lms-site/cbg.*.js', (r) => r.abort());
      await page.goto(p.path, { waitUntil: 'networkidle' });
      await expect.poll(() => page.evaluate(() => document.documentElement.className)).toContain('cbg-off');
      const hidden = await page.$$eval('[data-cbg] *', (els) =>
        els.filter((e) => e.textContent?.trim() && getComputedStyle(e).opacity === '0').length);
      expect(hidden).toBe(0);
      await expect(page.locator(p.root)).toBeVisible();
    });
  });
}
