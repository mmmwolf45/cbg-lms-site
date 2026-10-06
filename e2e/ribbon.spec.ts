import { expect, test, type Page } from '@playwright/test';
import { withoutSky } from './no-sky';

withoutSky(); // the sky's software WebGL starves these timing tests (e2e/no-sky.ts)

// The light ribbon under the course cards (src/motion/ribbon.ts) on the mock.

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
  await expect(page.locator('.cbg-ribbon')).not.toHaveCount(0);
}

// How much of the ribbon is drawn (0..1, all rows end to end), read from each row's clip transform.
const track = (page: Page) =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll<HTMLElement>('.cbg-ribbon')].map((r) => {
      const w = r.offsetWidth;
      const t = new DOMMatrix(getComputedStyle(r.querySelector('.cbg-ribbon__clip')!).transform).m41;
      return { w, d: w + t };
    });
    const total = rows.reduce((n, r) => n + r.w, 0);
    return { drawn: rows.reduce((n, r) => n + r.d, 0) / total, rows: rows.length };
  });

const cards = (page: Page) => page.locator('.cbg-gallery__track > li').count();

test.describe('laptop, full motion', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeEach(async ({ page }) => page.emulateMedia({ reducedMotion: 'no-preference' }));

  test('the ribbon draws with the pan, moves with the row and keeps its share through a resize', async ({ page }) => {
    const errors = watchErrors(page);
    await openHome(page);
    await expect(page.locator('[data-cbg-gallery]')).toHaveClass(/\bis-pan\b/);
    expect((await track(page)).rows).toBe(1); // the pan is one row
    const range = await page.evaluate(() => {
      const spacer = document.querySelector('[data-cbg-gallery]')!.parentElement!;
      return { top: spacer.getBoundingClientRect().top + scrollY, length: spacer.getBoundingClientRect().height - innerHeight };
    });
    await page.evaluate((y) => scrollTo(0, y), range.top);
    await page.waitForTimeout(1500);
    expect((await track(page)).drawn).toBeLessThan(0.05);

    await page.evaluate((y) => scrollTo(0, y), range.top + range.length * 0.5);
    await expect.poll(async () => (await track(page)).drawn, { timeout: 6000 }).toBeGreaterThan(0.4);
    expect((await track(page)).drawn).toBeLessThan(0.65);
    // The ribbons move with the row, and the art holds still inside its moving clip (the strands never slide).
    const moved = await page.evaluate(() => {
      const t = document.querySelector('.cbg-gallery__track')!.getBoundingClientRect().left;
      const s = document.querySelector('.cbg-ribbons')!.getBoundingClientRect().left;
      const art = document.querySelector('.cbg-ribbon__art')!.getBoundingClientRect().left;
      const row = document.querySelector('.cbg-ribbon')!.getBoundingClientRect().left;
      return { shift: Math.abs(t - s), art: Math.abs(art - row) };
    });
    expect(moved.shift).toBeLessThan(120); // the track's own offset in the gallery plus the damped lag
    expect(moved.art).toBeLessThan(1);
    // The front light shows while the ribbon draws.
    expect(await page.locator('.cbg-ribbon__head').evaluate((h) => Number(getComputedStyle(h).opacity))).toBeGreaterThan(0.5);

    await page.evaluate((y) => scrollTo(0, y), range.top + range.length + 10);
    await expect.poll(async () => (await track(page)).drawn, { timeout: 8000 }).toBeGreaterThan(0.99);

    // A resize redraws the strands at the new size, still whole.
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.waitForTimeout(800);
    expect((await track(page)).drawn).toBeGreaterThan(0.99);
    expect(errors).toEqual([]);
  });

  test('a live card shows its border beam on hover only', async ({ page }) => {
    await openHome(page);
    const card = page.locator('.cbg-course--live').first();
    const beam = card.locator('.cbg-beam');
    await expect(beam).toHaveCount(1);
    expect(await page.locator('.cbg-course--soon .cbg-beam').count()).toBe(0);
    await card.scrollIntoViewIfNeeded();
    expect(await beam.evaluate((b) => getComputedStyle(b).opacity)).toBe('0');
    await card.hover();
    await expect.poll(() => beam.evaluate((b) => Number(getComputedStyle(b).opacity)), { timeout: 4000 }).toBeGreaterThan(0.7);
  });
});

test('phone: the ribbon follows the swipe', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, baseURL });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await openHome(page);
  const row = page.getByRole('region', { name: 'Your courses' });
  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  expect((await track(page)).drawn).toBeLessThan(0.05);
  await row.evaluate((r) => r.scrollTo({ left: r.scrollWidth, behavior: 'instant' }));
  await expect.poll(async () => (await track(page)).drawn, { timeout: 6000 }).toBeGreaterThan(0.98);
  expect(errors).toEqual([]);
  await ctx.close();
});

test.describe('tablet grid', () => {
  test.use({ viewport: { width: 820, height: 1180 } });
  test('draws once, when in view', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openHome(page);
    expect((await track(page)).drawn).toBeLessThan(0.05);
    await page.locator('.cbg-gallery').scrollIntoViewIfNeeded();
    await expect.poll(async () => (await track(page)).drawn, { timeout: 10000 }).toBeGreaterThan(0.99);
    expect((await track(page)).rows).toBe(Math.ceil((await cards(page)) / 2)); // two cards a row
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('still: the ribbon whole, no lights, no beam', async ({ page }) => {
    const errors = watchErrors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHome(page);
    expect((await track(page)).drawn).toBeGreaterThan(0.99);
    expect(await page.locator('.cbg-ribbon__head').first().evaluate((h) => getComputedStyle(h).opacity)).toBe('0');
    expect(await page.locator('.cbg-beam').first().evaluate((b) => getComputedStyle(b).display)).toBe('none');
    // Still: nothing changes over time.
    await page.locator('.cbg-gallery').scrollIntoViewIfNeeded();
    const before = await page.locator('.cbg-ribbons').evaluate((s) => s.outerHTML);
    await page.waitForTimeout(600);
    expect(await page.locator('.cbg-ribbons').evaluate((s) => s.outerHTML)).toBe(before);
    expect(errors).toEqual([]);
  });
});
