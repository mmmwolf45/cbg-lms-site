import { expect, test, type Page } from '@playwright/test';

// Motion layer (T14) on the home mock. The static mock has no React, so a "route change" here is a
// pushState the router reacts to while our block stays in the DOM: enough to check teardown and re-setup.

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

// Opacity of every reveal target: the element itself, or each child of a stagger parent.
const revealOpacities = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-cbg-reveal]')]
      .flatMap((el) => (el.dataset.cbgReveal === 'stagger' ? [...el.children] : [el]))
      .map((el) => getComputedStyle(el).opacity),
  );

const counterStates = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-cbg-count]')].map((el) => ({
      final: Number(el.dataset.cbgCount) === Number((el.textContent ?? '').replace(/,/g, '')),
      // Screen readers read the .cbg-sr-only copy beside it: the counted element stays hidden from them.
      label: el.getAttribute('aria-hidden') === 'true' && el.nextElementSibling?.classList.contains('cbg-sr-only') === true,
    })),
  );

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => Math.round(innerHeight / 2));
  for (let y = 0; y <= height; y += step) {
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(120);
  }
}

const allFinal = (states: { final: boolean; label: boolean }[]) => states.every((s) => s.final && s.label);

test('reduced motion: everything is in its final state without scrolling', async ({ page }) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  const opacities = await revealOpacities(page);
  expect(opacities.every((o) => o === '1')).toBe(true);
  expect(allFinal(await counterStates(page))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.classList.contains('cbg-js'))).toBe(true);
  expect(errors).toEqual([]);
});

test('full motion: scrolling through reveals everything and counters land on their numbers', async ({ page }) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  const reveals = await revealOpacities(page);
  expect(reveals.length).toBeGreaterThan(0);
  // Below-the-fold content starts hidden (proves the motion layer is live).
  expect(reveals.some((o) => o !== '1')).toBe(true);

  await scrollThrough(page);

  await expect.poll(async () => (await revealOpacities(page)).every((o) => o === '1'), { timeout: 5000 }).toBe(true);
  await expect.poll(async () => allFinal(await counterStates(page)), { timeout: 5000 }).toBe(true);
  expect(await page.evaluate(() => document.documentElement.classList.contains('cbg-js'))).toBe(true);
  expect(errors).toEqual([]);
});

test('route change: teardown and re-setup keep finished reveals and still reveal the rest', async ({ page }) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight / 3));
  await page.waitForTimeout(1200); // reveals in view finish
  const shown = (await revealOpacities(page)).filter((o) => o === '1').length;
  expect(shown).toBeGreaterThan(0);
  const go = async (path: string) => {
    await page.evaluate((p) => history.pushState(null, '', p), path);
    await page.waitForTimeout(300); // router debounce is 100 ms
  };
  await go('/login');
  await go('/');
  // Finished reveals stay finished: a re-run never hides or replays them.
  expect((await revealOpacities(page)).filter((o) => o === '1').length).toBeGreaterThanOrEqual(shown);
  await scrollThrough(page);
  await expect.poll(async () => (await revealOpacities(page)).every((o) => o === '1'), { timeout: 5000 }).toBe(true);
  await expect.poll(async () => allFinal(await counterStates(page)), { timeout: 5000 }).toBe(true);
  // One thread driver, not two: its lit nodes match the drawn line at the bottom of the page.
  const lit = await page.evaluate(() => {
    const t = document.querySelector('[data-cbg-thread]');
    return t ? [t.querySelectorAll('.is-lit').length, t.querySelectorAll('.cbg-node').length] : [0, 0];
  });
  expect(lit[0]).toBe(lit[1]);
  expect(errors).toEqual([]);
});
