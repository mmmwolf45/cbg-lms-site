import { expect, test, type Page } from '@playwright/test';
import { withoutSky } from './no-sky';

withoutSky(); // the sky's software WebGL starves these timing tests (e2e/no-sky.ts)

// The night-sky effects on the home mock (picked 6 Oct 2026): strip (rise, gold near the mouse), support card
// (tilt, spotlight, border light), cursor (invert disc), About globe (cobe). Slow by design, so the polls wait.

const LAPTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
  });
  return errors;
}

async function openHome(page: Page) {
  await page.goto('/');
  if ((await page.locator('[data-cbg="home"]').count()) === 0) test.skip(true, 'home block not built yet');
  await expect.poll(() => page.evaluate(() => (window as { __cbg?: number }).__cbg)).toBe(1);
}

// The outlined strip is off in Build B (lite): OUTLINED in templates/sections/home-disciplines.ts. Its checks
// run whenever the page has it.
const outlined = async (page: Page) => (await page.locator('.cbg-strip').count()) > 0;

const center = async (page: Page, sel: string) => {
  const b = (await page.locator(sel).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test.describe('laptop, full motion', () => {
  test.use({ viewport: LAPTOP });
  test.beforeEach(({ page }) => page.emulateMedia({ reducedMotion: 'no-preference' }));

  test('strip: titles rise in once seen; letters fill gold near the mouse and fade back', async ({ page }) => {
    test.setTimeout(60000);
    const errors = watchErrors(page);
    await openHome(page);
    if (!(await outlined(page))) test.skip(true, 'plain strip in this build');
    const first = page.locator('.cbg-strip__n').first();
    await first.scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollBy(0, 200));
    await expect(first).toHaveClass(/is-in/);
    await page.waitForTimeout(1800); // the rise is 0.9 s, staggered over 0.6 s
    expect(await first.locator('span').nth(1).evaluate((l) => getComputedStyle(l).opacity)).toBe('1');
    // A letter near the middle of the screen (the strip drifts, so the first title may be off to the left).
    const i = await page.$$eval('.cbg-strip__n > span', (ls) => ls.findIndex((l) => {
      const r = l.getBoundingClientRect();
      return r.left > innerWidth * 0.4 && r.right < innerWidth * 0.6;
    }));
    const letter = page.locator('.cbg-strip__n > span').nth(i);
    const box = (await letter.boundingBox())!;
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(at.x, at.y, { steps: 10 });
    const k = () => letter.evaluate((l) => Number((l as HTMLElement).style.getPropertyValue('--k') || 0));
    // Slow by design, and much slower in a headless browser drawing WebGL in software (about 3 fps here, and a
    // frame counts 50 ms at most), so this checks the direction, not the timing.
    await expect.poll(k, { timeout: 10000 }).toBeGreaterThan(0.25);
    await page.mouse.move(at.x, 120, { steps: 10 }); // well away from the strip
    const high = await k();
    await expect.poll(k, { timeout: 10000 }).toBeLessThan(high * 0.7);
    expect(errors).toEqual([]);
  });

  test('support: the photo tilts, the spotlight lights, the text stays flat; the border light runs on screen', async ({ page }) => {
    const errors = watchErrors(page);
    await openHome(page);
    const plate = page.locator('.cbg-plate');
    await plate.scrollIntoViewIfNeeded();
    await expect(plate).toHaveClass(/is-on/);
    expect(await page.locator('.cbg-plate__beam > i').evaluate((i) => getComputedStyle(i).animationPlayState)).toBe('running');
    const b = (await plate.boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.85, b.y + b.height * 0.2, { steps: 12 });
    await expect(plate).toHaveClass(/is-lit/);
    await expect.poll(() => page.locator('.cbg-plate__bg').evaluate((e) => (e as HTMLElement).style.transform), { timeout: 3000 })
      .toMatch(/rotateX\([1-9][\d.]*deg\) rotateY\([1-9][\d.]*deg\)/);
    expect(await page.locator('.cbg-plate__body').evaluate((e) => getComputedStyle(e).transform)).toBe('none');
    await page.mouse.move(b.x + b.width / 2, b.y - 200, { steps: 8 });
    await expect(plate).not.toHaveClass(/is-lit/);
    expect(errors).toEqual([]);
  });

  test('cursor: an inverting disc over the big text only, a ring over a link, nothing over the hero', async ({ page }) => {
    const errors = watchErrors(page);
    await openHome(page);
    const cursor = page.locator('body > .cbg-cursor');
    await expect(cursor).toHaveCount(1);
    await expect(cursor).toHaveAttribute('aria-hidden', 'true');
    expect(await cursor.evaluate((c) => [getComputedStyle(c).mixBlendMode, getComputedStyle(c).pointerEvents])).toEqual(['difference', 'none']);
    await page.mouse.move(700, 450, { steps: 4 }); // the hero
    await expect(cursor).toHaveAttribute('data-state', 'off');
    await page.locator('#cbg-about h2').scrollIntoViewIfNeeded();
    const h2 = await center(page, '#cbg-about h2');
    await page.mouse.move(h2.x, h2.y, { steps: 8 });
    await expect(cursor).toHaveAttribute('data-state', 'on');
    const link = await center(page, '#cbg-about .cbg-link');
    await page.mouse.move(link.x, link.y, { steps: 8 });
    await expect(cursor).toHaveAttribute('data-state', 'link');
    expect(errors).toEqual([]);
  });

  test('globe: draws, turns slowly on its own, keeps the flat mark for screen readers', async ({ page }) => {
    const errors = watchErrors(page);
    await openHome(page);
    const panel = page.locator('.cbg-logos--globe');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toHaveClass(/is-ready/, { timeout: 5000 });
    await expect(panel.locator('[data-cbg-globe]')).toHaveAttribute('aria-hidden', 'true');
    await expect(panel.getByRole('img', { name: 'CBG Training Institute' })).toHaveCount(1);
    const shot = () => panel.locator('canvas').screenshot();
    const a = await shot();
    await page.waitForTimeout(1500);
    expect((await shot()).equals(a)).toBe(false); // it turns
    expect(errors).toEqual([]);
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: LAPTOP });
  test('everything still: names shown, no cursor, no tilt, a still gold edge, one still globe frame', async ({ page }) => {
    const errors = watchErrors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHome(page);
    if (await outlined(page)) expect(await page.locator('.cbg-strip__n > span').first().evaluate((l) => getComputedStyle(l).opacity)).toBe('1');
    await expect(page.locator('.cbg-cursor')).toHaveCount(0);
    const plate = page.locator('.cbg-plate');
    await plate.scrollIntoViewIfNeeded();
    await plate.hover();
    await page.waitForTimeout(400);
    await expect(plate).not.toHaveClass(/is-lit/);
    expect(await page.locator('.cbg-plate__beam').evaluate((e) => getComputedStyle(e).display)).toBe('none');
    expect(await plate.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe('rgba(214, 177, 96, 0.55)');
    const panel = page.locator('.cbg-logos--globe');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toHaveClass(/is-ready/, { timeout: 5000 });
    await page.waitForTimeout(300);
    const a = await panel.locator('canvas').screenshot();
    await page.waitForTimeout(1200);
    expect((await panel.locator('canvas').screenshot()).equals(a)).toBe(true); // still
    expect(errors).toEqual([]);
  });
});

test.describe('phone', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });
  test('titles rise, the border light runs; no cursor, no tilt layers', async ({ page }) => {
    const errors = watchErrors(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openHome(page);
    if (await outlined(page)) {
      const first = page.locator('.cbg-strip__n').first();
      await first.scrollIntoViewIfNeeded();
      await page.evaluate(() => scrollBy(0, 200));
      await expect(first).toHaveClass(/is-in/);
    }
    await expect(page.locator('.cbg-cursor')).toHaveCount(0);
    const plate = page.locator('.cbg-plate');
    await plate.scrollIntoViewIfNeeded();
    await expect(plate).toHaveClass(/is-on/);
    await expect(plate).not.toHaveClass(/is-fine/);
    expect(errors).toEqual([]);
  });
});
