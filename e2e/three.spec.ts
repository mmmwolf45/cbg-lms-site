import { expect, test, type Page } from '@playwright/test';

// The home page's 3D sections (src/motion/three-sections.ts, src/three/*) on the mock. Headless Chromium has
// WebGL2 through SwiftShader, so the 3D runs here (slowly): these check wiring and behaviour, not looks.

const LAPTOP = { width: 1440, height: 900 };

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
  });
  return errors;
}

const threeRequests = (page: Page) => {
  const urls: string[] = [];
  page.on('request', (r) => { if (/cbg-three-|\.glb$/.test(r.url())) urls.push(r.url()); });
  return urls;
};

async function openHome(page: Page) {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => (window as { __cbg?: number }).__cbg)).toBe(1);
}

// Scroll so the section is `f` of the way through its sticky stretch, in steps (the 3D follows scroll events).
async function through(page: Page, sel: string, f: number) {
  const target = await page.evaluate(([sel, f]) => {
    const r = document.querySelector(sel as string)!.getBoundingClientRect();
    return scrollY + r.top + (f as number) * Math.max(0, r.height - innerHeight);
  }, [sel, f] as const);
  for (let i = 1; i <= 8; i++) {
    await page.evaluate(([t, i]) => scrollTo(0, scrollY + (t - scrollY) * i / 8), [target, i] as const);
    await page.waitForTimeout(40);
  }
}

test.use({ viewport: LAPTOP });

test('the 3D code loads only when a 3D section nears, never on arrival', async ({ page }) => {
  const urls = threeRequests(page);
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  await page.waitForTimeout(1500);
  expect(urls).toEqual([]);
  await through(page, '#cbg-band', 0);
  await expect.poll(() => urls.some((u) => u.includes('cbg-three-')), { timeout: 15000 }).toBe(true);
  expect(errors).toEqual([]);
});

test('band: holds while the camera walks round the site, on the shared canvas', async ({ page }) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  await expect(page.locator('#cbg-band')).toHaveClass(/is-3d/);
  await through(page, '#cbg-band', 0.3);
  await expect(page.locator('[data-cbg-site3d] canvas.cbg-stage')).toHaveCount(1, { timeout: 20000 });
  // Sticky: the view stays under the navbar while the band scrolls through.
  const top = await page.locator('#cbg-band .cbg-wrap').evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeCloseTo(56, 0);
  expect(await page.locator('canvas.cbg-stage').count()).toBe(1); // one canvas for every 3D section
  expect(errors).toEqual([]);
});

test('course story: one course at a time beside its scene, following the scroll', async ({ page }) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  const story = page.locator('#cbg-courses');
  await expect(story).toHaveClass(/is-story/);
  const n = await page.locator('#cbg-courses [data-scene]').count();
  expect(n).toBeGreaterThan(1);
  for (const k of [0, n - 1]) {
    await through(page, '#cbg-courses', (k + 0.5) / n);
    await expect.poll(() => page.locator('#cbg-courses [data-scene].is-active').count(), { timeout: 15000 }).toBe(1);
    const active = await page.locator('#cbg-courses [data-scene]').evaluateAll((els) => els.findIndex((e) => e.classList.contains('is-active')));
    expect(active).toBe(k);
  }
  await expect(page.locator('#cbg-courses .cbg-story__stage canvas.cbg-stage')).toHaveCount(1, { timeout: 20000 });
  // The waiting courses are hidden; the active one shows.
  const ops = await page.locator('#cbg-courses [data-scene]').evaluateAll((els) => els.map((e) => [e.classList.contains('is-active'), getComputedStyle(e).opacity]));
  expect(ops.filter(([a]) => !a).every(([, o]) => o === '0')).toBe(true);
  expect(errors).toEqual([]);
});

test('course story: keyboard focus on a waiting course\'s link scrolls to its chapter', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  await through(page, '#cbg-courses', 0.05);
  const links = page.locator('#cbg-courses a.cbg-course__link');
  const count = await links.count();
  test.skip(count < 2, 'needs two live courses');
  await links.nth(count - 1).focus();
  await expect.poll(() => links.nth(count - 1).evaluate((a) => a.closest('[data-scene]')!.classList.contains('is-active')), { timeout: 10000 }).toBe(true);
});

test('reduced motion: no 3D at all; the card gallery and the band still stay', async ({ page }) => {
  const urls = threeRequests(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  await through(page, '#cbg-band', 0.5);
  await through(page, '#cbg-courses', 0.5);
  await page.waitForTimeout(1500);
  expect(urls).toEqual([]);
  await expect(page.locator('#cbg-band')).not.toHaveClass(/is-3d/);
  await expect(page.locator('#cbg-courses')).not.toHaveClass(/is-story/);
});
