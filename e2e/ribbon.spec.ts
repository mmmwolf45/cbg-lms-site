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

// How much of the ribbon is drawn (0..1, all rows end to end): each row's canvas slides in from the left, so its
// leading end (its left edge plus its width) against the row's own start, the first card at that height.
const track = (page: Page) =>
  page.evaluate(() => {
    const track = document.querySelector<HTMLElement>('.cbg-gallery__track')!;
    const lis = [...track.children] as HTMLElement[];
    const rows = [...document.querySelectorAll<HTMLCanvasElement>('.cbg-ribbon')].map((r) => {
      const w = r.offsetWidth;
      const m = new DOMMatrix(getComputedStyle(r).transform);
      const first = lis.find((li) => Math.abs(track.offsetTop + li.offsetTop - m.m42) < 2)!;
      return { w, d: Math.max(0, Math.min(w, m.m41 + w - (track.offsetLeft + first.offsetLeft))) };
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
    // The ribbons move with the row, behind the cards and as tall as them.
    const moved = await page.evaluate(() => {
      const t = document.querySelector('.cbg-gallery__track')!.getBoundingClientRect();
      const s = document.querySelector('.cbg-ribbons')!.getBoundingClientRect().left;
      const card = document.querySelector('.cbg-gallery__track > li')!.getBoundingClientRect();
      const r = document.querySelector('.cbg-ribbon')!.getBoundingClientRect();
      // Behind: the ribbons come before the track in the gallery and neither sets a z-index (ribbon.css).
      const before = !!(document.querySelector('.cbg-ribbons')!.compareDocumentPosition(document.querySelector('.cbg-gallery__track')!) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { shift: Math.abs(t.left - s), top: Math.abs(r.top - card.top), h: Math.abs(r.height - card.height), before };
    });
    expect(moved.shift).toBeLessThan(120); // the track's own offset in the gallery plus the damped lag
    expect([moved.top < 1, moved.h < 1, moved.before]).toEqual([true, true, true]);

    await page.evaluate((y) => scrollTo(0, y), range.top + range.length + 10);
    await expect.poll(async () => (await track(page)).drawn, { timeout: 8000 }).toBeGreaterThan(0.99);

    // A resize redraws the strands at the new size, still whole.
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.waitForTimeout(800);
    expect((await track(page)).drawn).toBeGreaterThan(0.99);
    expect(errors).toEqual([]);
  });

  test('the pin turning the grid into one row rebuilds the ribbon, even when the boxes keep their size', async ({ page }) => {
    // At 1409x897 the track and gallery boxes are the same size in the grid and in the pinned row, so only the
    // class change tells the ribbon (found in the app's preview pane, 6 Oct 2026).
    await page.setViewportSize({ width: 1409, height: 897 });
    await openHome(page);
    await expect(page.locator('[data-cbg-gallery]')).toHaveClass(/\bis-pan\b/);
    await expect.poll(async () => (await track(page)).rows).toBe(1);
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
  test('still: the ribbon whole, no beam', async ({ page }) => {
    const errors = watchErrors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHome(page);
    expect((await track(page)).drawn).toBeGreaterThan(0.99);
    expect(await page.locator('.cbg-beam').first().evaluate((b) => getComputedStyle(b).display)).toBe('none');
    // Still: nothing changes over time.
    await page.locator('.cbg-gallery').scrollIntoViewIfNeeded();
    const before = await page.locator('.cbg-ribbons').evaluate((s) => s.outerHTML);
    await page.waitForTimeout(600);
    expect(await page.locator('.cbg-ribbons').evaluate((s) => s.outerHTML)).toBe(before);
    expect(errors).toEqual([]);
  });
});
