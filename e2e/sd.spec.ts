import { expect, test, type Page } from '@playwright/test';
import { withoutSky } from './no-sky';

withoutSky(); // the sky's software WebGL starves timing tests (e2e/no-sky.ts)

// The Structural page (course 103) on the mock: the load-path hero and the bending moment beam
// (src/motion/beam.ts, its own lazy chunk). The X-ray section is covered by e2e/xray.spec.ts.
const PAGE = '/course/103-structural-design';
const LAPTOP = { width: 1440, height: 900 };

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}
const read = (page: Page, key: string) => page.locator(`[data-cbg-read="${key}"]`).textContent();
// Playwright's scrollIntoViewIfNeeded waits for stability and stalls on this long page; a plain scroll is enough.
const toBeam = async (page: Page) => {
  await page.locator('[data-cbg-bmd]').evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
};
const bars = (page: Page) => page.locator('[data-cbg-bar]').evaluateAll((ps) => ps.map((p) => p.getAttribute('d') ?? ''));

test.describe('laptop, full motion', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(LAPTOP);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  test('the hero mounts its stage and carries the load path', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(PAGE);
    await expect(page.locator('html')).toHaveClass(/\bcbg-scrub-on\b/);
    expect(await page.locator('[data-cbg-scrub]').getAttribute('data-cbg-path')).toContain('"lines"');
    expect(errors).toEqual([]);
  });

  test('the beam loads on its own chunk; supports and the slider drive the diagrams and the readout', async ({ page }) => {
    const errors = watchErrors(page);
    const chunk = page.waitForResponse((r) => /cbg-beam\.[\w-]+\.js$/.test(r.url()));
    await page.goto(PAGE);
    await chunk;
    await toBeam(page);
    await expect(page.locator('.cbg-bmd__types')).toBeVisible();
    await expect(page.locator('.cbg-bmd__slide')).toBeVisible();

    // Simply supported at midspan: bottom steel only.
    await expect.poll(() => read(page, 'sag')).toBe('150 kN·m');
    const [bottom, top] = await bars(page);
    expect(bottom).not.toBe('');
    expect(top).toBe('');

    // Fixed both ends: hogging at the supports, so top steel appears once the glide settles.
    await page.getByRole('button', { name: 'Fixed both ends', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fixed both ends', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await read(page, 'hog')).toBe('75 kN·m');
    await expect.poll(async () => (await bars(page))[1]).not.toBe('');

    // The slider (keyboard): End puts the load as far right as the supports allow.
    const slider = page.getByRole('slider', { name: 'Load position' });
    await slider.focus();
    await page.keyboard.press('End');
    expect(await read(page, 'at')).toBe('5.5 m');
    await expect(slider).toHaveAttribute('aria-valuetext', '5.5 m from the left end');
    expect(errors).toEqual([]);
  });
});

test('reduced motion: the beam still answers, at once', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(PAGE);
  await toBeam(page);
  await page.getByRole('button', { name: 'Cantilever', exact: true }).click();
  expect(await read(page, 'hog')).toBe('300 kN·m');
  await expect.poll(async () => (await bars(page))[0]).toBe('');
});

test('without the script the beam is a finished drawing with its readout', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.route(/cbg-beam\.[\w-]+\.js$/, (r) => r.abort());
  await page.goto(PAGE);
  await toBeam(page);
  await expect(page.locator('.cbg-bmd__types')).toBeHidden();
  expect(await read(page, 'sag')).toBe('150 kN·m');
  expect((await bars(page))[0]).not.toBe('');
});
