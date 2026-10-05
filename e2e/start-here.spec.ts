// T21 on the course mock. course.link's React is stripped from the mock, so the accordion can't really
// open here: we check that Start here clicks the right trigger and scrolls to Course Content.
// (The accordion itself opening on click is verified on the live draft in probe-native-course.spec.ts.)
import { expect, test } from '@playwright/test';
import { withoutSky } from './no-sky';

withoutSky(); // the sky's software WebGL starves these timing tests (e2e/no-sky.ts)

test('Start here clicks the Start Here trigger and brings Course Content into view', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/course/preview-101', { waitUntil: 'networkidle' });
  const link = page.locator('[data-cbg-action="start-here"]');
  test.skip((await link.count()) === 0, 'course block not built');

  await page.evaluate(() => {
    const t = [...document.querySelectorAll<HTMLElement>('#course_content button[aria-expanded]')]
      .find((b) => /Start Here/i.test(b.textContent ?? ''));
    t?.setAttribute('aria-expanded', 'false'); // pretend it's closed so a click is expected
    t?.addEventListener('click', () => ((window as unknown as { __clicked: string }).__clicked = t.textContent ?? ''));
  });
  await link.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __clicked?: string }).__clicked)).toMatch(/Start Here/);
  await expect.poll(() => page.evaluate(() => document.getElementById('course_content')!.getBoundingClientRect().top))
    .toBeLessThan(200);
  expect(new URL(page.url()).hash).toBe('');
  expect(errors).toEqual([]);
});

test('FAQ items open and close natively', async ({ page }) => {
  await page.goto('/course/preview-101', { waitUntil: 'networkidle' });
  const first = page.locator('[data-cbg-faq] details').first();
  test.skip((await first.count()) === 0, 'course block not built');
  await first.locator('summary').click();
  await expect(first).toHaveAttribute('open', '');
  await expect(first.locator('p')).toBeVisible();
  await first.locator('summary').click();
  await expect(first).not.toHaveAttribute('open', '');
});
