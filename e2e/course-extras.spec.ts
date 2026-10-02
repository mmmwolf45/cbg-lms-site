import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// T23 + T25 on the course mock: the hand of cards, assessment cards and quadrants, the field-guide shelf.
// Every motion has to land exactly on the reduced-motion layout, with no inline styles left behind.

const URL = '/course/preview-101';
const SECTIONS = ['included', 'assessment', 'trainers', 'bonus', 'field-guides'];
const SCREENS = 'test-results/screens';

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // The mock pulls course.link's own assets from the live origin; those network failures aren't ours.
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
  });
  return errors;
}

async function open(page: Page, reducedMotion: 'reduce' | 'no-preference') {
  await page.emulateMedia({ reducedMotion });
  await page.goto(URL);
  if ((await page.locator('[data-cbg-hand]').count()) === 0) test.skip(true, 'course main block not built yet');
  await expect.poll(() => page.evaluate(() => (window as { __cbg?: number }).__cbg)).toBe(1);
}

// Each card and cover: its box relative to its own list (so other sections' heights don't matter),
// its computed transform and any inline style left on it.
const layout = (page: Page) =>
  page.evaluate(() => {
    const rel = (sel: string, parentSel: string) => {
      const parent = document.querySelector(parentSel)!.getBoundingClientRect();
      return [...document.querySelectorAll<HTMLElement>(sel)].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          box: [r.left - parent.left, r.top - parent.top, r.width, r.height].map((n) => Math.round(n)),
          transform: getComputedStyle(el).transform,
          opacity: getComputedStyle(el).opacity,
          style: el.getAttribute('style') ?? '',
        };
      });
    };
    return { cards: rel('[data-cbg-hand] > *', '[data-cbg-hand]'), covers: rel('.cbg-cover', '[data-cbg-shelf]') };
  });

const quads = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-cbg-quadrants] li')].map((li) => ({
      count: li.querySelector('[data-cbg-count]')?.textContent?.trim(),
      opacity: [...li.children].map((c) => getComputedStyle(c).opacity),
      ring: getComputedStyle(li.querySelector('.cbg-pie circle')!).strokeDashoffset,
      wedge: getComputedStyle(li.querySelector('.cbg-pie path')!).transform,
    })),
  );

const examStyles = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.cbg-exams > *')].map((el) => ({
      transform: getComputedStyle(el).transform,
      opacity: getComputedStyle(el).opacity,
    })),
  );

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => Math.round(innerHeight / 2));
  for (let y = 0; y <= height; y += step) {
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(2000); // the last deals, fans and counts finish
}

// Layout shifts whose moved nodes sit inside our sections (other sections have their own suites).
const watchShifts = (page: Page) =>
  page.addInitScript((ids: string[]) => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources?: { node?: Node }[] }[]) {
        const ours = e.sources?.some((s) => {
          const el = s.node instanceof Element ? s.node : s.node?.parentElement;
          return ids.some((id) => el?.closest(`#cbg-${id}`));
        });
        if (ours && !e.hadRecentInput) w.__cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  }, SECTIONS);

for (const width of [1440, 390]) {
  test(`${width}px: every motion lands on the reduced-motion layout, without layout shift`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = watchErrors(page);
    await open(page, 'reduce');
    const final = await layout(page);

    await watchShifts(page);
    await open(page, 'no-preference');
    await scrollThrough(page);
    const after = await layout(page);

    // The hand: dealt into the grid cells, no transform, no inline style, list marked done.
    expect(after.cards.map((c) => c.box)).toEqual(final.cards.map((c) => c.box));
    for (const c of after.cards) expect(c).toMatchObject({ transform: 'none', opacity: '1', style: '' });
    await expect(page.locator('[data-cbg-hand]')).toHaveClass(/cbg-done/);

    // The shelf: covers back on their designed transforms (course.css), nothing inline.
    expect(after.covers.map((c) => [c.box, c.transform])).toEqual(final.covers.map((c) => [c.box, c.transform]));
    for (const c of after.covers) expect(c).toMatchObject({ opacity: '1', style: '' });

    // Assessment cards and quadrants: all in, numbers on 25, rings and wedges drawn.
    for (const e of await examStyles(page)) expect(e).toEqual({ transform: 'none', opacity: '1' });
    const q = await quads(page);
    expect(q).toHaveLength(4);
    for (const tile of q) {
      expect(tile.count).toBe('25');
      expect(tile.opacity.every((o) => o === '1')).toBe(true);
      expect(parseFloat(tile.ring)).toBe(0);
      expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(tile.wedge);
    }

    // No sideways scrolling from cards sliding in from the edges.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
    expect(errors).toEqual([]);

    mkdirSync(SCREENS, { recursive: true });
    await page.locator('#cbg-field-guides').screenshot({ path: `${SCREENS}/extras-shelf-open-${width}.png` });
    await page.locator('#cbg-assessment').screenshot({ path: `${SCREENS}/extras-assessment-${width}.png` });
  });
}

test('reduced motion: final states without scrolling, nothing inline', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = watchErrors(page);
  await open(page, 'reduce');
  const { cards, covers } = await layout(page);
  for (const c of [...cards, ...covers]) expect(c).toMatchObject({ opacity: '1', style: '' });
  for (const c of cards) expect(c.transform).toBe('none');
  for (const e of await examStyles(page)) expect(e).toEqual({ transform: 'none', opacity: '1' });
  for (const tile of await quads(page)) {
    expect(tile.count).toBe('25');
    expect(tile.opacity.every((o) => o === '1')).toBe(true);
    expect(parseFloat(tile.ring)).toBe(0);
  }
  expect(errors).toEqual([]);
});

test('laptop: the hand waits fanned, deals on entering view; a route change clears it mid-way', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = watchErrors(page);
  await open(page, 'no-preference');
  const hand = page.locator('[data-cbg-hand]');
  // Grid top at 90% of the viewport: before the deal (it starts at 75%), the cards are fanned.
  const toFraction = (f: number) =>
    page.evaluate((f) => {
      const top = document.querySelector('[data-cbg-hand]')!.getBoundingClientRect().top;
      scrollTo(0, scrollY + top - innerHeight * f);
    }, f);
  await toFraction(0.9);
  await page.waitForTimeout(300);
  const fanned = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-cbg-hand] > *')].map((el) => [getComputedStyle(el).transform, getComputedStyle(el).opacity]),
  );
  for (const [t, o] of fanned) expect([t !== 'none', o]).toEqual([true, '1']);

  await toFraction(0.5);
  await page.waitForTimeout(140);
  mkdirSync(SCREENS, { recursive: true });
  await page.screenshot({ path: `${SCREENS}/extras-hand-mid-deal-1440.png` });

  // Leave the course mid-deal: teardown drops every inline style; the hand isn't done, so it's set up again.
  await page.evaluate(() => history.pushState(null, '', '/somewhere-else'));
  await page.waitForTimeout(300); // router debounce is 100 ms
  const styles = await page.evaluate(() => [...document.querySelectorAll('[data-cbg-hand] > *, .cbg-cover')].map((el) => el.getAttribute('style') ?? ''));
  expect(styles.every((s) => s === '')).toBe(true);
  await page.evaluate((u) => history.pushState(null, '', u), URL);
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, 50);
  await expect(hand).toHaveClass(/cbg-done/, { timeout: 4000 });
  await page.waitForTimeout(300);
  const left = await page.evaluate(() => [...document.querySelectorAll('[data-cbg-hand] > *')].map((el) => el.getAttribute('style') ?? ''));
  expect(left.every((s) => s === '')).toBe(true);

  // Guide 01 lifts on hover once the shelf is open.
  await page.locator('[data-cbg-shelf]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-cbg-shelf]')).toHaveClass(/cbg-done/, { timeout: 4000 });
  await page.locator('.cbg-cover--out').hover();
  await expect.poll(() => page.locator('.cbg-cover--out').evaluate((el) => getComputedStyle(el).translate)).toBe('0px -8px');
  expect(errors).toEqual([]);
});

test('phone: the shelf row still scrolls with the arrow keys', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'no-preference');
  const shelf = page.locator('[data-cbg-shelf]');
  await shelf.scrollIntoViewIfNeeded();
  await shelf.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect.poll(() => shelf.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
