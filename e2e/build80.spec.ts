import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { withoutSky } from './no-sky';

withoutSky(); // the sky's software WebGL starves these timing tests (e2e/no-sky.ts)

// T24: the 80-hour build on the course mock. Laptop: floors build with the unit list's scroll while the
// drawing stays sticky beside it (no pin); phone: the drawing builds once in view; reduced motion: final.
const COURSE = '/course/preview-101';
const CARD = 'div:has(> #course_content) + div'; // the enrol card (native-overrides.css, note 15)
const SCREENS = 'test-results/screens';
mkdirSync(SCREENS, { recursive: true });

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // The mock pulls course.link's own assets from the live origin; those network failures aren't ours.
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
  });
  return errors;
}

async function open(page: Page, width: number, reducedMotion: 'reduce' | 'no-preference') {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion });
  await page.goto(COURSE);
  await expect.poll(() => page.evaluate(() => (window as { __cbg?: number }).__cbg)).toBe(1);
}

const state = (page: Page) =>
  page.evaluate(() => {
    const list = document.querySelector('.cbg-units')!.getBoundingClientRect();
    return {
      built: [...document.querySelectorAll('[data-cbg-floor]')].map((f) => f.classList.contains('is-built')),
      active: document.querySelectorAll('[data-cbg-unit].is-active').length,
      // The viewport's middle is over the unit list (with a little slack for the scrub's own frame).
      inside: list.top < innerHeight / 2 - 4 && list.bottom > innerHeight / 2 + 4,
      num: document.querySelector('.cbg-build__total [data-cbg-count]')!.textContent,
    };
  });

const cardBox = (page: Page) => page.locator(CARD).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return [r.left, r.top, r.width, r.height].map(Math.round);
});

test('laptop: floors build 1 to 4 with the list, one active unit, the figure ends at 80, the enrol card stays put', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, 1440, 'no-preference');
  // The course enhancers arrive in their own chunk: wait for the scrub mode.
  await expect(page.locator('.cbg-build.is-scrub')).toHaveCount(1);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.cbg-build__plan')!).position)).toBe('sticky');

  const top = await page.evaluate(() => document.querySelector('#cbg-units')!.getBoundingClientRect().top + scrollY);
  const end = await page.evaluate(() => document.querySelector('.cbg-units')!.getBoundingClientRect().bottom + scrollY);
  await page.evaluate((y) => scrollTo(0, y), top - 400);
  await page.waitForTimeout(300);
  const box = await cardBox(page);
  const seen: number[] = [];
  let shot = false;
  for (let y = top - 400; y <= end; y += 120) {
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.waitForTimeout(200);
    const s = await state(page);
    // Built floors are always a run from the bottom: never a floor above an unbuilt one.
    const n = s.built.filter(Boolean).length;
    expect(s.built).toEqual(s.built.map((_, i) => i < n));
    seen.push(n);
    expect(s.active).toBeLessThanOrEqual(1);
    if (s.inside) expect(s.active).toBe(1);
    expect(await cardBox(page)).toEqual(box);
    if (!shot && n === 2) {
      shot = true;
      await page.screenshot({ path: `${SCREENS}/build80-laptop-mid.png` });
    }
  }
  // Floors appeared one at a time, in order, ending with all four.
  expect(seen.at(-1)).toBe(4);
  expect([...new Set(seen)]).toEqual([0, 1, 2, 3, 4]);
  await expect.poll(async () => (await state(page)).num).toBe('80');
  expect(shot).toBe(true);

  // Scrolling back up reverses the build.
  await page.evaluate((y) => scrollTo(0, y), top - 400);
  await expect.poll(async () => (await state(page)).built.some(Boolean), { timeout: 3000 }).toBe(false);
  await expect.poll(async () => (await state(page)).num).toBe('0');
  expect(await cardBox(page)).toEqual(box);
  expect(await page.locator('.pin-spacer').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('route change: the teardown leaves the static drawing and list', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, 1440, 'no-preference');
  await expect(page.locator('.cbg-build.is-scrub')).toHaveCount(1);
  await page.locator('[data-cbg-unit="2"]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await expect(page.locator('[data-cbg-unit].is-active')).toHaveCount(1);
  await page.evaluate(() => history.pushState(null, '', '/learn/lesson-1'));
  await page.waitForTimeout(400); // router debounce
  const left = await page.evaluate(() => ({
    classes: document.querySelectorAll('#cbg-units :is(.is-scrub, .is-active, .is-built)').length,
    fills: document.querySelectorAll('.cbg-floor__fill').length,
    styled: [...document.querySelectorAll('.cbg-build__svg [style]')].filter((el) => el.getAttribute('style')).length,
    num: document.querySelector('.cbg-build__total [data-cbg-count]')!.textContent,
  }));
  expect(left).toEqual({ classes: 0, fills: 0, styled: 0, num: '80' });
  expect(errors).toEqual([]);
});

test('phone: no pin, the drawing builds once in view and ends fully built', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, 390, 'no-preference');
  await expect.poll(() => page.locator('.cbg-floor__fill').count()).toBe(4); // enhancer ran
  expect(await page.locator('.cbg-build.is-scrub').count()).toBe(0);
  expect((await state(page)).built.some(Boolean)).toBe(false);

  const svg = page.locator('.cbg-build__svg');
  await svg.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await expect.poll(async () => (await state(page)).built, { timeout: 5000 }).toEqual([true, true, true, true]);
  await expect.poll(async () => (await state(page)).num).toBe('80');
  // Scroll on past it: it stays built (it builds once, no scrub).
  await page.evaluate(() => scrollBy(0, innerHeight * 2));
  await page.waitForTimeout(300);
  expect((await state(page)).built).toEqual([true, true, true, true]);
  expect(await page.locator('.pin-spacer').count()).toBe(0);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.cbg-build__plan')!).position)).toBe('static');
  expect(await page.locator('[data-cbg-unit].is-active').count()).toBe(0);
  await svg.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await page.locator('#cbg-units .cbg-build__plan').screenshot({ path: `${SCREENS}/build80-phone-final.png` });
  expect(errors).toEqual([]);
});

for (const width of [1440, 390]) {
  test(`reduced motion at ${width}: everything is built and final without scrolling`, async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, width, 'reduce');
    await page.waitForTimeout(500); // give the enhancer chunk time to (not) act
    const s = await page.evaluate(() => ({
      fills: document.querySelectorAll('.cbg-floor__fill').length,
      classes: document.querySelectorAll('#cbg-units :is(.is-scrub, .is-active)').length,
      offsets: [...document.querySelectorAll('[data-cbg-floor] rect')].map((r) => getComputedStyle(r).strokeDashoffset),
      opacity: [...document.querySelectorAll('[data-cbg-floor] text, [data-cbg-floor] path')].map((t) => getComputedStyle(t).opacity),
      fill: [...document.querySelectorAll('[data-cbg-floor] rect')].map((r) => getComputedStyle(r).fill),
      num: document.querySelector('.cbg-build__total [data-cbg-count]')!.textContent,
    }));
    expect(s.fills).toBe(0);
    expect(s.classes).toBe(0);
    expect(new Set(s.offsets)).toEqual(new Set(['0px']));
    expect(new Set(s.opacity)).toEqual(new Set(['1']));
    expect(s.fill.every((f) => f !== 'none')).toBe(true);
    expect(s.num).toBe('80');
    expect(errors).toEqual([]);
  });
}
