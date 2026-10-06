import { expect, test, type Page } from '@playwright/test';
import { withoutSky } from './no-sky';

withoutSky(); // the sky's software WebGL starves these timing tests (e2e/no-sky.ts)

// The support card that shrinks into the "Talk to us" dock (src/motion/dock.ts) on the mock.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // The mock pulls course.link's own assets from the live origin; those network failures aren't ours.
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
  });
  return errors;
}

async function openHome(page: Page) {
  await page.goto('/');
  if ((await page.locator('[data-cbg="home"]').count()) === 0) test.skip(true, 'home block not built yet (templates/*)');
  await expect.poll(() => page.evaluate(() => (window as { __cbg?: number }).__cbg)).toBe(1);
  await expect(page.locator('.cbg-dock')).toHaveCount(1);
}

// The scroll positions where the card sticks and where the shrink ends (dock.ts: the wrap's ::after is the hold
// plus the shrink).
const stretch = (page: Page) =>
  page.evaluate(() => {
    const s = document.querySelector<HTMLElement>('.cbg-support')!;
    const top = parseFloat(s.style.getPropertyValue('--cbg-dock-top'));
    const run = parseFloat(s.style.getPropertyValue('--cbg-dock-run'));
    const stick = s.querySelector('.cbg-wrap')!.getBoundingClientRect().top + scrollY - top;
    return { top, stick, end: stick + run };
  });

const state = (page: Page) =>
  page.evaluate(() => {
    const plate = document.querySelector<HTMLElement>('.cbg-plate')!;
    const dock = document.querySelector<HTMLElement>('.cbg-dock')!;
    return {
      frameTop: document.querySelector('.cbg-support .cbg-frame')!.getBoundingClientRect().top,
      scale: new DOMMatrix(getComputedStyle(plate).transform).a,
      plate: Number(getComputedStyle(plate).opacity),
      plateVisible: getComputedStyle(plate).visibility,
      dock: Number(getComputedStyle(dock).opacity),
      dockVisible: getComputedStyle(dock).visibility,
    };
  });

test.describe('laptop, full motion', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('the card holds, shrinks into the dock, and grows back out of it', async ({ page }) => {
    const errors = watchErrors(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openHome(page);
    await expect(page.locator('.cbg-support')).toHaveClass(/\bis-dock\b/);
    const s = await stretch(page);
    expect((await state(page)).dockVisible).toBe('hidden');

    // Stuck and still full size during the hold.
    await page.evaluate((y) => scrollTo(0, y), s.stick + 20);
    await page.waitForTimeout(800);
    let now = await state(page);
    expect(now.frameTop).toBeCloseTo(s.top, 0);
    expect(now.scale).toBeCloseTo(1, 2);

    // Halfway: smaller, still stuck, the dock not yet there.
    await page.evaluate((y) => scrollTo(0, y), (s.stick + s.end) / 2 + 40);
    await page.waitForTimeout(400);
    await expect.poll(async () => (await state(page)).scale, { timeout: 6000 }).toBeLessThan(0.6);
    now = await state(page);
    expect(now.frameTop).toBeCloseTo(s.top, 0);
    expect(now.dock).toBeLessThan(0.05);

    // Past the stretch: the card has gone into the dock, which opens WhatsApp and stays for the rest of the page.
    await page.evaluate((y) => scrollTo(0, y), s.end + 200);
    await expect.poll(async () => (await state(page)).dock, { timeout: 10000 }).toBeGreaterThan(0.99);
    await expect.poll(async () => (await state(page)).plateVisible, { timeout: 10000 }).toBe('hidden');
    await expect(page.getByRole('link', { name: 'Talk to us on WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\//);
    const dock = (await page.locator('.cbg-dock').boundingBox())!;
    expect(dock.x).toBeLessThan(40);
    expect(dock.y + dock.height).toBeGreaterThan(900 - 40);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(600);
    expect((await state(page)).dock).toBeGreaterThan(0.99);

    // Back up above the card: it grows back out of the dock, whole and clickable.
    await page.evaluate((y) => scrollTo(0, y), s.stick - 300);
    await expect.poll(async () => (await state(page)).scale, { timeout: 10000 }).toBeCloseTo(1, 3);
    now = await state(page);
    expect([now.plate, now.plateVisible, now.dockVisible]).toEqual([1, 'visible', 'hidden']);
    await expect(page.locator('.cbg-support')).not.toHaveClass(/is-docking/);
    expect(errors).toEqual([]);
  });
});

test('phone: the card fits the screen and shrinks into the dock', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, baseURL, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await openHome(page);
  await expect(page.locator('.cbg-support')).toHaveClass(/\bis-dock\b/);
  const s = await stretch(page);
  await page.evaluate((y) => scrollTo(0, y), s.end + 100);
  await expect.poll(async () => (await state(page)).dock, { timeout: 10000 }).toBeGreaterThan(0.99);
  const dock = (await page.locator('.cbg-dock').boundingBox())!;
  expect(dock.x).toBeGreaterThanOrEqual(16);
  expect(dock.x + dock.width).toBeLessThan(390 / 2);
  expect(dock.y + dock.height).toBeLessThanOrEqual(844);
  expect(errors).toEqual([]);
  await ctx.close();
});

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('no shrink: the card scrolls as usual and the dock simply shows once it has gone', async ({ page }) => {
    const errors = watchErrors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHome(page);
    await expect(page.locator('.cbg-support')).not.toHaveClass(/is-dock/);
    expect(await page.locator('.cbg-support .cbg-frame').evaluate((f) => getComputedStyle(f).position)).toBe('relative');
    await page.locator('.cbg-plate').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    expect((await state(page)).dockVisible).toBe('hidden');
    await page.locator('.cbg-about').scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollBy(0, 400));
    await expect.poll(async () => (await state(page)).dockVisible).toBe('visible');
    const now = await state(page);
    expect([now.dock, now.scale, now.plate]).toEqual([1, 1, 1]);
    expect(await page.locator('.cbg-dock').evaluate((d) => getComputedStyle(d).transitionDuration)).toBe('0s');
    expect(errors).toEqual([]);
  });
});
