import { expect, test, type Page } from '@playwright/test';

// "From blueprint to built" home hero (T15) on the home mock.

const LINES = 49; // segments in src/motion/blueprint-paths.ts

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
  if ((await page.locator('[data-cbg-hero]').count()) === 0) test.skip(true, 'home hero not built yet');
}

// The photo and every ancestor up to the hero: nothing may hide it (it is the LCP element).
const photoOpacity = (page: Page) =>
  page.evaluate(() => {
    let el: Element | null = document.querySelector('[data-cbg-hero] .cbg-hero__media img');
    let o = 1;
    while (el && !el.matches('[data-cbg-hero]')) {
      o *= Number(getComputedStyle(el).opacity);
      el = el.parentElement;
    }
    return o;
  });

const heroState = (page: Page) =>
  page.evaluate(() => {
    const v = document.querySelector('[data-cbg-hero] .cbg-hero__visual')!;
    const svg = v.querySelector('svg.cbg-hero__lines')!;
    const lines = [...svg.querySelectorAll('line')];
    return {
      lines: lines.length,
      viewBox: svg.getAttribute('viewBox'),
      opacity: Number(getComputedStyle(svg.querySelector('g') ?? svg).opacity),
      // A line is mid-draw (or hidden) when its dash offset is anything but 0.
      drawing: lines.filter((l) => parseFloat(getComputedStyle(l).strokeDashoffset) !== 0).length,
      filter: getComputedStyle(v.querySelector('.cbg-hero__media')!).filter,
      done: v.classList.contains('cbg-done'),
    };
  });

test.describe('full motion', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('photo visible from the start, lines draw, then the photo lights up under faint lines', async ({ page }) => {
    const errors = watchErrors(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openHome(page);
    expect(await photoOpacity(page)).toBe(1);
    await expect(page.locator('[data-cbg-hero] .cbg-hero__media img')).toBeVisible();

    // Early on: lines exist and some are still drawing, the photo is dimmed by a filter, never hidden.
    await expect.poll(async () => (await heroState(page)).lines).toBe(LINES);
    const early = await heroState(page);
    expect(early.drawing).toBeGreaterThan(0);
    expect(early.filter).toContain('brightness');
    expect(early.viewBox).toBe('0 0 1536 1024');
    expect(await photoOpacity(page)).toBe(1);

    await page.waitForTimeout(3200);
    await expect.poll(async () => (await heroState(page)).done, { timeout: 4000 }).toBe(true);
    const end = await heroState(page);
    expect(end.lines).toBe(LINES);
    expect(end.drawing).toBe(0);
    expect(end.opacity).toBeGreaterThanOrEqual(0.25);
    expect(end.opacity).toBeLessThanOrEqual(0.35);
    expect(end.filter).toBe('none');
    expect(await photoOpacity(page)).toBe(1);
    expect(errors).toEqual([]);
  });

  test('pointer parallax moves the layers apart, and they re-centre on leave', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openHome(page);
    const hero = (await page.locator('[data-cbg-hero]').boundingBox())!;
    const shift = () =>
      page.evaluate(() => {
        const x = (el: Element) => new DOMMatrix(getComputedStyle(el).transform).m41;
        return [x(document.querySelector('.cbg-hero__lines')!), x(document.querySelector('.cbg-hero__media img')!)];
      });
    await page.mouse.move(hero.x + hero.width - 4, hero.y + hero.height / 2, { steps: 6 });
    await expect.poll(async () => (await shift())[0], { timeout: 3000 }).toBeGreaterThan(9);
    const [lines, photo] = await shift();
    expect(lines).toBeLessThanOrEqual(12.5);
    expect(photo).toBeLessThan(-3);
    expect(photo).toBeGreaterThanOrEqual(-5.5);
    await page.mouse.move(hero.x + hero.width / 2, hero.y + hero.height + 300, { steps: 3 });
    await expect.poll(async () => (await shift()).map((v) => Math.abs(v) < 0.5), { timeout: 3000 }).toEqual([true, true]);
  });

  test('re-setup after a route change keeps one set of lines', async ({ page }) => {
    const errors = watchErrors(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openHome(page);
    await expect.poll(async () => (await heroState(page)).lines).toBe(LINES);
    for (const path of ['/login', '/', '/login', '/']) {
      await page.evaluate((p) => history.pushState(null, '', p), path);
      await page.waitForTimeout(300); // router debounce is 100 ms
    }
    await expect.poll(async () => (await heroState(page)).lines).toBe(LINES);
    expect(await page.locator('[data-cbg-hero] svg [data-cbg-blueprint]').count()).toBe(1);
    // Torn down mid-intro, the photo is never left dark.
    await expect.poll(async () => (await heroState(page)).filter, { timeout: 5000 }).toBe('none');
    expect(errors).toEqual([]);
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('lines use the phone crop and draw to the same final state', async ({ page }) => {
    const errors = watchErrors(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openHome(page);
    expect(await photoOpacity(page)).toBe(1);
    await expect.poll(async () => (await heroState(page)).viewBox).toBe('171 0 1365 1024');
    await expect.poll(async () => (await heroState(page)).done, { timeout: 7000 }).toBe(true);
    const end = await heroState(page);
    expect(end.lines).toBe(LINES);
    expect(end.drawing).toBe(0);
    expect(errors).toEqual([]);
  });
});

test('reduced motion: lines shown at once, none mid-draw, photo lit', async ({ page }) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  await expect.poll(async () => (await heroState(page)).lines).toBe(LINES);
  const s = await heroState(page);
  expect(s.drawing).toBe(0);
  expect(s.opacity).toBeGreaterThanOrEqual(0.25);
  expect(s.opacity).toBeLessThanOrEqual(0.35);
  expect(s.filter).toBe('none');
  expect(await photoOpacity(page)).toBe(1);
  expect(errors).toEqual([]);
});

test('without the bundle: plain photo, empty svg', async ({ page }) => {
  await page.route('**/cbg-lms-site/cbg.*.js', (r) => r.abort());
  await page.goto('/');
  if ((await page.locator('[data-cbg-hero]').count()) === 0) test.skip(true, 'home hero not built yet');
  await expect.poll(() => page.evaluate(() => document.documentElement.className), { timeout: 6000 }).toBe('cbg-off');
  expect(await page.locator('[data-cbg-hero] svg.cbg-hero__lines line').count()).toBe(0);
  expect(await photoOpacity(page)).toBe(1);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.cbg-hero__media')!).filter)).toBe('none');
});
