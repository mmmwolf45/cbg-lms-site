import { expect, test, type Page } from '@playwright/test';
import { withoutSky } from './no-sky';

withoutSky(); // the sky's software WebGL starves these timing tests (e2e/no-sky.ts)

// The hero options (content/hero-options/iosh-level-3.yaml), each on its own mock page.
const PAGE = (v: string) => `/course/preview-101-${v}`;
const DIAGRAMS = [
  { visual: 'risk-matrix', sel: '[data-cbg-matrix]' },
  { visual: 'hierarchy', sel: '[data-cbg-tiers]' },
  { visual: 'swiss-cheese', sel: '[data-cbg-cheese]' },
];

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
  });
  return errors;
}

// The option chunks the page fetched (cbg-hero-*.js).
function heroChunks(page: Page) {
  const got: string[] = [];
  page.on('request', (r) => {
    const m = r.url().match(/cbg-hero-([a-z]+)\./);
    if (m) got.push(m[1]);
  });
  return got;
}

// Every element of the selector fully opaque with no transform left: the finished state.
const settled = (page: Page, sel: string) =>
  page.locator(sel).evaluateAll((els) => els.every((e) => {
    const cs = getComputedStyle(e);
    return cs.opacity !== '0' && (cs.transform === 'none' || !e.closest('.cbg-matrix__grid'));
  }));

test('the live course page loads no hero option script', async ({ page }) => {
  const chunks = heroChunks(page);
  await page.goto('/course/preview-101');
  await expect(page.locator('[data-cbg-hazard]')).toHaveClass(/is-on/);
  expect(chunks).toEqual([]);
});

for (const { visual, sel } of DIAGRAMS) {
  test.describe(visual, () => {
    test('full motion: plays when seen, ends in the finished state, loads only its own script', async ({ page }) => {
      const errors = watchErrors(page);
      const chunks = heroChunks(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(PAGE(visual));
      const fig = page.locator(sel);
      await expect(fig).toBeAttached();
      await fig.scrollIntoViewIfNeeded();
      await expect(fig).toHaveClass(/cbg-done/, { timeout: 20_000 });
      expect(await settled(page, `${sel} :is(.cbg-risk, .cbg-tier__bar, .cbg-tier__ex, .cbg-slice, .cbg-cheese__end--to strong)`)).toBe(true);
      expect(chunks).toEqual([{ 'risk-matrix': 'matrix', hierarchy: 'tiers', 'swiss-cheese': 'cheese' }[visual]]);
      expect(errors).toEqual([]);
    });

    test('reduced motion: the finished state at once, no motion', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(PAGE(visual));
      const fig = page.locator(sel);
      await fig.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await expect(fig).not.toHaveClass(/cbg-done/);
      expect(await settled(page, `${sel} :is(.cbg-risk, .cbg-tier__bar, .cbg-tier__ex, .cbg-slice, .cbg-cheese__end--to strong)`)).toBe(true);
    });
  });
}

test('swiss-cheese: the fixed layer ends with its hole closed and the ray beyond it faint', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(PAGE('swiss-cheese'));
  const h = await page.locator('.cbg-slice.is-fix').evaluate((e) => getComputedStyle(e).getPropertyValue('--h').trim());
  expect(h).toBe('0');
  expect(Number(await page.locator('.cbg-cheese__ray--out').evaluate((e) => getComputedStyle(e).opacity))).toBeLessThan(0.3);
});

test.describe('make-it-safe', () => {
  test.beforeEach(async ({ page }) => {
    const res = await page.request.get(PAGE('make-it-safe'));
    test.skip(!res.ok(), 'the made-safe photo is not built yet (content/hero-options/iosh-level-3.yaml)');
  });

  test('full motion: starts as found, the line wipes across, every label turns to its control', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(PAGE('make-it-safe'));
    const box = page.locator('[data-cbg-safe]');
    await expect(box).toHaveClass(/is-on/);
    await expect(page.locator('.cbg-safe-pin.is-risk')).toHaveCount(6);
    await page.locator('.cbg-safe__view').scrollIntoViewIfNeeded();
    await expect(box).toHaveClass(/cbg-done/, { timeout: 15_000 });
    await expect(page.locator('.cbg-safe-pin.is-risk')).toHaveCount(0);
    expect(await page.locator('.cbg-safe__view').evaluate((e) => e.style.getPropertyValue('--cut'))).toBe('100%');
    expect(errors).toEqual([]);
  });

  test('the slider: a named control the keyboard moves; the pins follow the line', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(PAGE('make-it-safe'));
    const range = page.getByRole('slider', { name: 'Compare the site as found and made safe' });
    await expect(range).toBeVisible();
    await expect(range).toHaveValue('100');
    await range.focus();
    await page.keyboard.press('Home');
    await expect(range).toHaveValue('0');
    await expect(range).toHaveAttribute('aria-valuetext', 'Made safe: 0%');
    await expect(page.locator('.cbg-safe-pin.is-risk')).toHaveCount(6);
    await range.fill('50');
    // Pins left of the middle are made safe, the rest still show their hazard.
    const xs = await page.locator('.cbg-safe-pin').evaluateAll((ps) => ps.map((p) => [Number((p as HTMLElement).dataset.cbgX), p.classList.contains('is-risk')]));
    for (const [x, risk] of xs) expect(risk).toBe((x as number) > 50);
  });

  test('without the script: the made-safe photo and the fixes in words', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(PAGE('make-it-safe'));
    await expect(page.locator('.cbg-safe__range')).toBeHidden();
    await expect(page.locator('.cbg-safe-list li')).toHaveCount(6);
    await ctx.close();
  });
});
