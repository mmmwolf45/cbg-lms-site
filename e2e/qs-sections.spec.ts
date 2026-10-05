import { existsSync, mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { withoutSky } from './no-sky';

withoutSky(); // the sky's software WebGL starves these timing tests (e2e/no-sky.ts)

// The QS sections (certificates, trainers, testimonials, placements, careers) on the course mock: the QS
// preview page (dist/preview/qs.html, scripts/build-preview.ts), which scripts/serve.ts serves at the QS path.
// Its blocks load their images from the local build, so new photos work before they are deployed.

const QS_URL = '/course/102-quantity-surveying';
const SECTIONS = ['certificates', 'trainers', 'testimonials', 'placements', 'careers'];
const SCREENS = 'test-results/screens';
const PAGE = 'dist/preview/qs.html';

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
  });
  return errors;
}

async function open(page: Page, reducedMotion: 'reduce' | 'no-preference', js = true) {
  test.skip(!existsSync(PAGE), 'QS preview not built yet');
  await page.emulateMedia({ reducedMotion });
  await page.goto(QS_URL);
  if (js) await expect.poll(() => page.evaluate(() => (window as { __cbg?: number }).__cbg)).toBe(1);
}

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => Math.round(innerHeight / 2));
  for (let y = 0; y <= height; y += step) {
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1800); // the last reveals and the sheets straightening finish
}

// Every visible piece of our sections, the placement list's real names, the sheets' tilt.
const state = (page: Page) =>
  page.evaluate((ids) => {
    const shown = (el: Element) => getComputedStyle(el).opacity === '1' && el.getBoundingClientRect().height > 0;
    return {
      sections: ids.map((id) => !!document.getElementById(`cbg-${id}`)),
      hidden: ids.flatMap((id) => [...document.querySelectorAll(`#cbg-${id} :is(.cbg-section-head, li, h3)`)])
        .filter((el) => !el.closest('.cbg-wall') && !shown(el))
        .map((el) => `${el.closest('section')!.id} ${el.tagName} ${el.className} ${getComputedStyle(el).opacity} ${el.getBoundingClientRect().height}`),
      sheets: [...document.querySelectorAll('.cbg-cert__sheet')].map((el) => getComputedStyle(el).rotate),
      names: document.querySelectorAll('.cbg-wall__list > li').length,
      listBox: document.querySelector('.cbg-wall__list')?.getBoundingClientRect().height ?? 0,
      rows: [...document.querySelectorAll('.cbg-wall__rows')].map((r) => r.getAttribute('aria-hidden')),
      wide: document.documentElement.scrollWidth > innerWidth,
    };
  }, SECTIONS);

const rowX = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.cbg-wall__row')].map((r) => new DOMMatrix(getComputedStyle(r).transform).m41));

for (const width of [1280, 390]) {
  test(`${width}px: the sections land in their final state, the wall drifts both ways, no axe issues`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = watchErrors(page);
    await open(page, 'no-preference');
    const before = await state(page);
    expect(before.sections.every(Boolean)).toBe(true);

    // The wall: rows of aria-hidden copies; the real list is still all there for screen readers.
    expect(before.rows).toEqual(['true']);
    await page.locator('#cbg-placements').scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 10);
    await page.waitForTimeout(900);
    const a = await rowX(page);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(900);
    const b = await rowX(page);
    expect(a.length).toBe(3);
    const moved = b.map((x, i) => x - a[i]!);
    expect(moved[0]).toBeLessThan(0); // row 1 drifts left
    expect(moved[1]).toBeGreaterThan(0); // row 2 drifts right
    mkdirSync(SCREENS, { recursive: true });
    await page.locator('#cbg-placements').screenshot({ path: `${SCREENS}/qs-placements-${width}.png` });

    // Back to the top, then down through the page the way a reader does (a jump straight past a section
    // leaves its reveal waiting until the reader scrolls back to it).
    await page.evaluate(() => scrollTo(0, 0));
    await scrollThrough(page);
    const after = await state(page);
    expect(after.hidden).toEqual([]);
    expect(after.sheets.every((r) => r === 'none' || r === '0deg')).toBe(true);
    expect(after.wide).toBe(false);
    expect(errors).toEqual([]);

    const axe = await new AxeBuilder({ page }).include(SECTIONS.map((id) => `#cbg-${id}`)).analyze();
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);

    for (const id of SECTIONS) await page.locator(`#cbg-${id}`).screenshot({ path: `${SCREENS}/qs-${id}-${width}.png` });
  });
}

test('reduced motion: everything shown at once, the wall is the plain list, nothing tilted', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const errors = watchErrors(page);
  await open(page, 'reduce');
  const s = await state(page);
  expect(s.hidden).toEqual([]);
  expect(s.rows).toEqual([]);
  expect(s.listBox).toBeGreaterThan(200);
  expect(s.sheets.every((r) => r === 'none' || r === '0deg')).toBe(true);
  expect(errors).toEqual([]);
  mkdirSync(SCREENS, { recursive: true });
  await page.locator('#cbg-placements').screenshot({ path: `${SCREENS}/qs-placements-reduced-1280.png` });
});

test('no JS: every section reads in its final state', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await open(page, 'no-preference', false);
  const s = await state(page);
  expect(s.sections.every(Boolean)).toBe(true);
  expect(s.hidden).toEqual([]);
  expect(s.rows).toEqual([]);
  expect(s.listBox).toBeGreaterThan(200);
  await ctx.close();
});

test('phone: the quotes row scrolls with the arrow keys', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'no-preference');
  const row = page.locator('.cbg-quotes');
  await row.scrollIntoViewIfNeeded();
  await row.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
});

test('laptop: the quotes grid does not scroll, so it is no tab stop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 'no-preference');
  await expect(page.locator('.cbg-quotes')).toHaveAttribute('tabindex', '-1');
});
