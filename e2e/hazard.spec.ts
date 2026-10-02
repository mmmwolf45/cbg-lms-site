import { expect, test, type Page } from '@playwright/test';
import { loadCourse } from '../content/schema';

// Hazard Scan on the course hero (T22), on the course mock.

const COURSE = '/course/preview-101';
const SCREENS = 'test-results/screens';
const hazards = loadCourse('iosh-level-3.yaml').hero.hazards!;

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // The mock pulls course.link's own assets from the live origin; those network failures aren't ours.
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
  });
  return errors;
}

const box = (page: Page) => page.locator('[data-cbg-hazard]');
const dots = (page: Page) => page.locator('.cbg-hazard-dot');
const tip = (page: Page) => page.locator('.cbg-hazard-tip');
const caption = (page: Page) => page.locator('.cbg-hazard-caption');
const stageTransform = (page: Page) =>
  page.locator('.cbg-hazard__stage').evaluate((el) => getComputedStyle(el).transform);

async function open(page: Page, motion: 'reduce' | 'no-preference') {
  await page.emulateMedia({ reducedMotion: motion });
  await page.goto(COURSE);
  await expect(box(page)).toHaveClass(/is-on/);
  // The sweep waits until the photo is on screen (it sits below the fold on the mock).
  await page.locator('[data-cbg-hazard] .cbg-frame').scrollIntoViewIfNeeded();
}

// Every marker drawn: shown, fully opaque and at its full size.
const allShown = (page: Page) =>
  dots(page).evaluateAll((ds) => ds.filter((d) => d.checkVisibility() && getComputedStyle(d).opacity === '1').length);

// The marker's centre lands on its hazard: its centre is at at/1536, at/1024 of the photo.
async function expectOnHazard(page: Page, i: number) {
  const img = (await page.locator('[data-cbg-hazard] img').boundingBox())!;
  const d = (await dots(page).nth(i).boundingBox())!;
  const [x, y] = hazards[i].at;
  expect(Math.abs(d.x + d.width / 2 - (img.x + (x / 1536) * img.width))).toBeLessThan(1.5);
  expect(Math.abs(d.y + d.height / 2 - (img.y + (y / 1024) * img.height))).toBeLessThan(1.5);
}

test.describe('laptop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('sweep reveals all markers, then hover and focus show the label and detail', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, 'no-preference');
    await expect(box(page)).toHaveClass(/is-scan/);
    await expect(page.locator('.cbg-hazard__scan')).toBeVisible();
    await expect(box(page)).toHaveClass(/cbg-done/, { timeout: 6000 });
    await expect(page.locator('.cbg-hazard__scan')).toBeHidden();
    await expect.poll(() => allShown(page)).toBe(6);
    for (let i = 0; i < 6; i++) await expectOnHazard(page, i);
    // The list is still there for screen readers, visually hidden.
    await expect(page.locator('[data-cbg-hazard-list] li')).toHaveCount(6);

    // Accessible names are the labels.
    for (const [i, z] of hazards.entries()) await expect(dots(page).nth(i)).toHaveAccessibleName(z.label);

    await expect(page.locator('.cbg-hazard-dot.is-chip')).toHaveCount(0); // the chips fade after the sweep
    await dots(page).nth(1).hover();
    await expect(tip(page)).toBeVisible();
    await expect(tip(page).locator('strong')).toHaveText(hazards[1].label);
    await expect(tip(page).locator('span')).toHaveText(hazards[1].detail);
    await expect(tip(page)).toHaveClass(/is-left/); // the ladder is on the right: the tip flips
    await expectTipInFrame(page);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SCREENS}/hazard-laptop-tooltip.png` });
    await page.keyboard.press('Escape');
    await expect(tip(page)).toBeHidden();

    await page.mouse.move(5, 5);
    await dots(page).nth(4).focus();
    await expect(tip(page)).toBeVisible();
    await expect(tip(page).locator('strong')).toHaveText(hazards[4].label);
    await expect(tip(page).locator('span')).toHaveText(hazards[4].detail);
    await expect(dots(page).nth(4)).toHaveAccessibleDescription(`${hazards[4].label} ${hazards[4].detail}`);
    await expectTipInFrame(page);
    // Tab to the next marker: only one tip, now for it.
    await page.keyboard.press('Tab');
    await expect(tip(page).locator('strong')).toHaveText(hazards[5].label);
    await expect(page.locator('.cbg-hazard-dot.is-open')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(tip(page)).toBeHidden();
    // No zoom on laptop; no tour controls.
    expect(await stageTransform(page)).toBe('none');
    await expect(page.locator('.cbg-hazard-tour')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('markers stay on their hazards at 1024 and 768', async ({ page }) => {
    await open(page, 'reduce');
    for (const width of [1024, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      for (let i = 0; i < 6; i++) await expectOnHazard(page, i);
    }
  });

  test('mid-sweep, a marker the line has not reached yet is visible once focused', async ({ page }) => {
    await open(page, 'no-preference');
    await expect(box(page)).toHaveClass(/is-scan/);
    const last = dots(page).nth(5); // the grinder, far right: the line reaches it last
    await last.focus();
    await page.waitForTimeout(350); // the 300ms opacity transition
    const s = await last.evaluate((d) => ({
      waiting: d.closest('.is-scan') !== null && !d.classList.contains('is-seen'),
      opacity: getComputedStyle(d).opacity,
    }));
    expect(s.waiting).toBe(true); // the line hasn't reached it yet
    expect(s.opacity).toBe('1');
  });
});

async function expectTipInFrame(page: Page) {
  const f = (await page.locator('[data-cbg-hazard] .cbg-frame').boundingBox())!;
  const t = (await tip(page).boundingBox())!;
  expect(t.x).toBeGreaterThanOrEqual(f.x);
  expect(t.y).toBeGreaterThanOrEqual(f.y);
  expect(t.x + t.width).toBeLessThanOrEqual(f.x + f.width + 0.5);
  expect(t.y + t.height).toBeLessThanOrEqual(f.y + f.height + 0.5);
}

test.describe('phone tour', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('after the sweep, step through each hazard and back to the whole photo', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, 'no-preference');
    await expect(box(page)).toHaveClass(/is-tour/);
    const count = page.locator('.cbg-hazard-count');
    const next = page.getByRole('button', { name: 'Next', exact: true });
    await expect(count).toHaveText('1 of 6', { timeout: 6000 });
    await expect(caption(page).locator('strong')).toHaveText(hazards[0].label);
    await expect(caption(page).locator('span')).toHaveText(hazards[0].detail);
    await expect(page.locator('.cbg-hazard-dot.is-active')).toHaveCount(1);
    expect(await stageTransform(page)).not.toBe('none');
    for (const b of await page.locator('.cbg-hazard-btn').all()) {
      const r = (await b.boundingBox())!;
      expect(r.width).toBeGreaterThanOrEqual(44);
      expect(r.height).toBeGreaterThanOrEqual(44);
    }
    await page.locator('[data-cbg-hazard]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SCREENS}/hazard-phone-tour-1.png` });
    // The automatic first step is not announced; from the first press on, steps are.
    await expect(caption(page)).toHaveAttribute('aria-live', 'off');

    await next.tap();
    await expect(caption(page)).toHaveAttribute('aria-live', 'polite');
    await expect(count).toHaveText('2 of 6');
    await expect(caption(page).locator('strong')).toHaveText(hazards[1].label);
    await expect(caption(page).locator('span')).toHaveText(hazards[1].detail);
    await next.tap();
    await expect(count).toHaveText('3 of 6');
    await expect(caption(page).locator('strong')).toHaveText(hazards[2].label);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SCREENS}/hazard-phone-tour-3.png` });

    for (let i = 3; i < 6; i++) await next.tap();
    await expect(count).toHaveText('6 of 6');
    await next.tap();
    await expect(count).toHaveText('All 6');
    await expect(caption(page)).toBeEmpty();
    await expect(page.locator('.cbg-hazard-dot.is-active')).toHaveCount(0);
    await expect.poll(() => stageTransform(page)).toBe('none');
    // Previous from the whole photo goes to the last hazard; tapping a marker jumps to it.
    await page.getByRole('button', { name: 'Previous' }).tap();
    await expect(count).toHaveText('6 of 6');
    await next.tap();
    await dots(page).nth(3).tap();
    await expect(count).toHaveText('4 of 6');
    await expect(caption(page).locator('strong')).toHaveText(hazards[3].label);
    await expect(tip(page)).toBeHidden(); // no tips in the tour
    expect(errors).toEqual([]);
  });
});

test('a route change tears down cleanly and the next setup adds no duplicate listeners', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'reduce');
  const count = page.locator('.cbg-hazard-count');
  const next = page.getByRole('button', { name: 'Next', exact: true });
  await next.click();
  await expect(count).toHaveText('2 of 6');
  // Away from the course: the photo is back to the whole view, markers and controls hidden.
  await page.evaluate(() => history.pushState({}, '', '/'));
  await expect(box(page)).not.toHaveClass(/is-on/);
  expect(await stageTransform(page)).toBe('none');
  await expect(dots(page).first()).toBeHidden();
  await expect(page.locator('.cbg-hazard-tour')).toBeHidden();
  await expect(caption(page)).toBeEmpty();
  await expect(caption(page)).toHaveAttribute('aria-live', 'off');
  // And back: one Next moves one step.
  await page.evaluate(() => history.pushState({}, '', '/course/preview-101'));
  await expect(count).toHaveText('1 of 6');
  await next.click();
  await expect(count).toHaveText('2 of 6');
  await expect(page.locator('.cbg-hazard-dot.is-active')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('reduced motion: no sweep, markers at once; the phone tour changes instantly', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'reduce');
  await expect(box(page)).not.toHaveClass(/is-scan/);
  await expect(page.locator('.cbg-hazard__scan')).toBeHidden();
  expect(await allShown(page)).toBe(6);
  await dots(page).nth(0).hover();
  await expect(tip(page).locator('strong')).toHaveText(hazards[0].label);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(box(page)).toHaveClass(/is-tour/);
  await expect(page.locator('.cbg-hazard-count')).toHaveText('1 of 6');
  const t = await stageTransform(page);
  expect(t).not.toBe('none');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  expect(await stageTransform(page)).not.toBe(t); // no transition: the new zoom is there at once
  expect(errors).toEqual([]);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });

  test('the photo and the plain list, no markers', async ({ page }) => {
    await page.goto(COURSE);
    const list = page.locator('[data-cbg-hazard-list]');
    await expect(list).toBeVisible();
    await expect(list.locator('li strong')).toHaveText(hazards.map((z) => z.label));
    await expect(list.locator('li span')).toHaveText(hazards.map((z) => z.detail));
    await expect(page.locator('[data-cbg-hazard] img')).toBeVisible();
    await expect(dots(page).first()).toBeHidden();
    expect(await dots(page).evaluateAll((ds) => ds.filter((d) => d.checkVisibility()).length)).toBe(0);
    await expect(page.locator('.cbg-hazard-tour')).toBeHidden();
  });
});
