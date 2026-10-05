import { expect, test, type Page } from '@playwright/test';
import { withoutSky } from './no-sky';
import { noStory, withoutStory } from './no-story';

withoutSky(); // the sky's software WebGL starves these timing tests (e2e/no-sky.ts)
withoutStory(); // the card gallery: the courses story's fallback (e2e/no-story.ts, e2e/course-story.spec.ts)

// The gold track under the course cards (src/motion/gold-track.ts) on the mock.

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
  await expect(page.locator('.cbg-track__node')).not.toHaveCount(0);
}

// How much of the line is drawn (0..1) and which nodes are lit.
const track = (page: Page) =>
  page.evaluate(() => {
    const line = document.querySelector<SVGPathElement>('.cbg-track__line')!;
    const total = line.getTotalLength();
    const drawn = (total + 1 - parseFloat(getComputedStyle(line).strokeDashoffset)) / total;
    const lit = [...document.querySelectorAll('.cbg-track__node')].map((n) => n.classList.contains('is-lit'));
    return { drawn, lit, n: lit.length, nLit: lit.filter(Boolean).length };
  });

const cards = (page: Page) => page.locator('.cbg-gallery__track > li').count();

test.describe('laptop, full motion', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeEach(async ({ page }) => page.emulateMedia({ reducedMotion: 'no-preference' }));

  test('the line draws with the pan, nodes light in order and stay lit through a resize', async ({ page }) => {
    const errors = watchErrors(page);
    await openHome(page);
    await expect(page.locator('[data-cbg-gallery]')).toHaveClass(/\bis-pan\b/);
    expect((await track(page)).n).toBe(await cards(page));
    const range = await page.evaluate(() => {
      const spacer = document.querySelector('[data-cbg-gallery]')!.parentElement!;
      return { top: spacer.getBoundingClientRect().top + scrollY, length: spacer.getBoundingClientRect().height - innerHeight };
    });
    await page.evaluate((y) => scrollTo(0, y), range.top);
    await page.waitForTimeout(1500);
    const start = await track(page);
    expect(start.drawn).toBeLessThan(0.05);
    expect(start.nLit).toBeLessThanOrEqual(1);

    await page.evaluate((y) => scrollTo(0, y), range.top + range.length * 0.5);
    await expect.poll(async () => (await track(page)).drawn, { timeout: 6000 }).toBeGreaterThan(0.4);
    const mid = await track(page);
    expect(mid.drawn).toBeLessThan(0.65);
    // Lit nodes are a prefix: the line reaches them in order.
    expect(mid.lit.indexOf(false)).toBe(mid.nLit);
    expect(mid.nLit).toBeGreaterThan(1);
    expect(mid.nLit).toBeLessThan(mid.n);
    // The SVG moves with the row.
    const moved = await page.evaluate(() => {
      const t = document.querySelector('.cbg-gallery__track')!.getBoundingClientRect().left;
      const s = document.querySelector('.cbg-track')!.getBoundingClientRect().left;
      return Math.abs(t - s);
    });
    expect(moved).toBeLessThan(120); // the track's own offset in the gallery plus the damped lag

    await page.evaluate((y) => scrollTo(0, y), range.top + range.length + 10);
    await expect.poll(async () => (await track(page)).nLit, { timeout: 8000 }).toBe(mid.n);

    // A resize moves the nodes but keeps the same elements, still lit.
    await page.evaluate(() => document.querySelectorAll('.cbg-track__node').forEach((n, i) => ((n as HTMLElement).dataset.k = String(i))));
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.waitForTimeout(800);
    expect(await page.locator('.cbg-track__node[data-k]').count()).toBe(mid.n);
    expect((await track(page)).nLit).toBe(mid.n);
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

test('phone: the line follows the swipe', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, baseURL: 'http://localhost:4173' });
  await ctx.addInitScript(noStory);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await openHome(page);
  const row = page.getByRole('region', { name: 'Your courses' });
  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  expect((await track(page)).drawn).toBeLessThan(0.05);
  await row.evaluate((r) => r.scrollTo({ left: r.scrollWidth, behavior: 'instant' }));
  await expect.poll(async () => (await track(page)).nLit, { timeout: 6000 }).toBe(await cards(page));
  expect((await track(page)).drawn).toBeGreaterThan(0.98);
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
    await expect.poll(async () => (await track(page)).nLit, { timeout: 8000 }).toBe(await cards(page));
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('still: the line whole, every node lit, no transitions, no beam', async ({ page }) => {
    const errors = watchErrors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHome(page);
    const t = await track(page);
    expect(t.drawn).toBeGreaterThan(0.99);
    expect(t.nLit).toBe(t.n);
    expect(await page.locator('.cbg-track__dot').first().evaluate((d) => getComputedStyle(d).transitionDuration)).toBe('0s');
    expect(await page.locator('.cbg-beam').first().evaluate((b) => getComputedStyle(b).display)).toBe('none');
    // Still: nothing changes over time.
    await page.locator('.cbg-gallery').scrollIntoViewIfNeeded();
    const before = await page.locator('.cbg-track').evaluate((s) => s.outerHTML);
    await page.waitForTimeout(600);
    expect(await page.locator('.cbg-track').evaluate((s) => s.outerHTML)).toBe(before);
    expect(errors).toEqual([]);
  });
});
