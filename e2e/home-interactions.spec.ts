import { expect, test, type Page } from '@playwright/test';

// Home interactions (T16) on the mock. The mock has course.link's navbar markup but none of its JS,
// so clicking the native Login button opens nothing here: we check that our link clicks it.

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
}

// Counts clicks on course.link's navbar Login button (window.__loginClicks).
const spyLogin = (page: Page) =>
  page.evaluate(() => {
    const w = window as { __loginClicks?: number };
    w.__loginClicks = 0;
    const b = [...document.querySelectorAll('#navbar button')].find((x) => x.textContent?.trim() === 'Login');
    if (!b) throw new Error('no navbar Login button in the mock');
    b.addEventListener('click', () => (w.__loginClicks = (w.__loginClicks ?? 0) + 1));
  });
const loginClicks = (page: Page) => page.evaluate(() => (window as { __loginClicks?: number }).__loginClicks);

const tickOffsets = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-cbg-ticks] .cbg-tick path')].map((p) => parseFloat(getComputedStyle(p).strokeDashoffset)),
  );

test('Log in (click) opens course.link\'s login: clicks the navbar Login button, no hash change', async ({ page }) => {
  const errors = watchErrors(page);
  await openHome(page);
  await spyLogin(page);
  const link = page.locator('[data-cbg-action="login"]').first();
  await link.click();
  await expect.poll(() => loginClicks(page)).toBe(1);
  expect(new URL(page.url()).hash).toBe('');
  expect(errors).toEqual([]);
});

test('Log in works by keyboard (focus, Enter)', async ({ page }) => {
  const errors = watchErrors(page);
  await openHome(page);
  await spyLogin(page);
  const link = page.locator('[data-cbg-action="login"]').first();
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => loginClicks(page)).toBe(1);
  expect(new URL(page.url()).hash).toBe('');
  expect(errors).toEqual([]);
});

test('full motion: the first-steps ticks start undrawn and draw in when scrolled into view', async ({ page }) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  const before = await tickOffsets(page);
  expect(before.length).toBeGreaterThan(0);
  expect(before.every((o) => o === 1)).toBe(true);
  await page.locator('[data-cbg-ticks]').scrollIntoViewIfNeeded();
  await expect.poll(async () => (await tickOffsets(page)).every((o) => o === 0), { timeout: 5000 }).toBe(true);
  await expect(page.locator('[data-cbg-ticks]')).toHaveClass(/cbg-done/);
  const textOpacity = await page.evaluate(() =>
    [...document.querySelectorAll('[data-cbg-ticks] > li > span')].map((s) => getComputedStyle(s).opacity),
  );
  expect(textOpacity.every((o) => o === '1')).toBe(true);
  expect(errors).toEqual([]);
});

test('reduced motion: the ticks are drawn without scrolling', async ({ page }) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  const offsets = await tickOffsets(page);
  expect(offsets.length).toBeGreaterThan(0);
  expect(offsets.every((o) => o === 0)).toBe(true);
  expect(errors).toEqual([]);
});

test('course card hover: the gold rule extends and the card lifts', async ({ page }) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  const card = page.locator('.cbg-course').first();
  await card.scrollIntoViewIfNeeded();
  // Let the stagger reveal finish so the card is in its resting state.
  await expect(page.locator('.cbg-course-grid')).toHaveClass(/cbg-done/, { timeout: 5000 });
  await page.mouse.move(0, 0);
  const state = () =>
    card.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { rule: parseFloat(getComputedStyle(el, '::before').width), shadow: cs.boxShadow, translate: cs.translate, box: el.getBoundingClientRect().top };
    });
  const rest = await state();
  await card.hover({ position: { x: 20, y: 60 } });
  await page.waitForTimeout(400); // --cbg-dur-fast is 200ms
  const hover = await state();
  expect(hover.rule).toBeGreaterThan(rest.rule + 100);
  expect(hover.shadow).not.toBe(rest.shadow);
  expect(hover.translate).not.toBe(rest.translate);
  expect(rest.box - hover.box).toBeCloseTo(4, 0);
  expect(errors).toEqual([]);
});

test('course card keyboard focus extends the gold rule too', async ({ page }) => {
  await openHome(page);
  const card = page.locator('.cbg-course').first();
  const rule = () => card.evaluate((el) => parseFloat(getComputedStyle(el, '::before').width));
  const rest = await rule();
  await card.locator('a').first().focus();
  await expect.poll(rule).toBeGreaterThan(rest + 100);
});

test('route change: drawn ticks stay drawn after teardown and re-setup', async ({ page }) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  await page.locator('[data-cbg-ticks]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-cbg-ticks]')).toHaveClass(/cbg-done/, { timeout: 5000 });
  for (const path of ['/login', '/']) {
    await page.evaluate((p) => history.pushState(null, '', p), path);
    await page.waitForTimeout(300); // router debounce is 100 ms
  }
  expect((await tickOffsets(page)).every((o) => o === 0)).toBe(true);
  expect(errors).toEqual([]);
});
