import { readFileSync, existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { withoutSky } from './no-sky';

withoutSky(); // the sky's software WebGL starves these timing tests (e2e/no-sky.ts)

// The home band's orbiting night site (SPEC section 5.1.2, src/motion/site-orbit.ts) on the home mock.
// The block names its poster and frames on the Pages base; this test serves them from dist/.
const TYPES: Record<string, string> = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', js: 'text/javascript', css: 'text/css', json: 'application/json' };
const FRAME = /\/site-orbit\/[ls]\/f\d+\.avif$/;

async function open(page: Page) {
  const frames: string[] = [];
  const errors: string[] = [];
  await page.route('https://mmmwolf45.github.io/cbg-lms-site/**', (r) => {
    const url = r.request().url();
    const file = 'dist/' + new URL(url).pathname.replace('/cbg-lms-site/', '');
    if (FRAME.test(url)) frames.push(url);
    if (!existsSync(file)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ body: readFileSync(file), contentType: TYPES[file.split('.').pop()!] ?? 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } });
  });
  page.on('pageerror', (e) => errors.push(e.message));
  // A request the OS network stack drops under load (net::ERR_NO_BUFFER_SPACE) isn't an error of ours; a
  // 404 or a script error still is.
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource: net::') && errors.push(m.text()));
  await page.goto('/', { waitUntil: 'load' });
  if ((await page.locator('[data-cbg-orbit]').count()) === 0) test.skip(true, 'band not built yet');
  await expect.poll(() => page.evaluate(() => (window as { __cbg?: number }).__cbg)).toBe(1);
  return { frames, errors };
}

const state = (page: Page) =>
  page.evaluate(() => {
    const q = (s: string) => document.querySelector<HTMLElement>(s)!;
    return {
      pin: q('.cbg-orbit').offsetHeight,
      stage: q('.cbg-orbit__stage').offsetHeight,
      stageTop: Math.round(q('.cbg-orbit__stage').getBoundingClientRect().top),
      position: getComputedStyle(q('.cbg-orbit__stage')).position,
      canvasOn: q('.cbg-orbit__canvas').classList.contains('is-on'),
      frame: Number(q('.cbg-orbit__canvas').dataset.frame ?? -1),
    };
  });

// Scroll to f (0..1) of the band's sticky stretch, in small steps like a wheel, then let the film settle.
async function scrollBand(page: Page, f: number, settle = 2500) {
  await page.evaluate(async (f) => {
    const pin = document.querySelector<HTMLElement>('.cbg-orbit')!, stage = document.querySelector<HTMLElement>('.cbg-orbit__stage')!;
    const y = scrollY + pin.getBoundingClientRect().top - 56 + (pin.offsetHeight - stage.offsetHeight) * f;
    const y0 = scrollY;
    for (let k = 1; k <= 20; k++) {
      scrollTo(0, Math.round(y0 + ((y - y0) * k) / 20));
      await new Promise((r) => requestAnimationFrame(r));
    }
  }, f);
  await page.waitForTimeout(settle);
}

test.describe('laptop, full motion', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('frames load only near the band; the stage holds while the frames advance, then lets go', async ({ page }) => {
    test.setTimeout(60000); // 15 s of fixed settles, plus the wait for the last frames to decode below
    const { frames, errors } = await open(page);
    await page.waitForTimeout(1500);
    expect(frames, 'no band frames at the top of the page').toHaveLength(0);

    await scrollBand(page, 0, 3000);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((u) => u.includes('/site-orbit/l/'))).toBe(true);
    const s0 = await state(page);
    // 0.9 of a screen of scrolling (6 Oct 2026; it was two screens for a half turn, now about 60 degrees).
    expect(s0.pin - s0.stage).toBeGreaterThan(900 * 0.8);
    expect(s0.pin - s0.stage).toBeLessThan(900 * 1);
    expect(s0.stageTop).toBe(56);
    expect(s0.canvasOn).toBe(true);
    expect(s0.frame).toBeLessThanOrEqual(1);

    await scrollBand(page, 0.5);
    const s1 = await state(page);
    expect(s1.stageTop).toBe(56);
    expect(s1.frame).toBeGreaterThan(6); // 22 frames over the 60 degrees (6 Oct 2026; 64 over 180 before)
    expect(s1.frame).toBeLessThan(15);

    await scrollBand(page, 1);
    // The last frames load last (frame 1, every 4th, then the rest), and the nearest decoded one shows
    // until they decode; with the suite's parallel workers decoding the course films too, that can outlast
    // the settle, and loading speed isn't what this checks.
    await expect.poll(async () => (await state(page)).frame, { timeout: 15000 }).toBeGreaterThanOrEqual(20);
    const s2 = await state(page);
    expect(s2.stageTop).toBe(56);

    await page.evaluate(() => scrollBy(0, 400));
    await page.waitForTimeout(300);
    expect((await state(page)).stageTop).toBeLessThan(0); // released: it scrolls away with the page

    await scrollBand(page, 0.25, 4500); // three quarters of the turn back: at least 1.8 s by design
    const back = await state(page);
    expect(back.frame).toBeGreaterThan(2);
    expect(back.frame).toBeLessThan(9);
    expect(errors).toEqual([]);
  });

  test('a fast jump through the band glides; the frame never leaps', async ({ page }) => {
    await open(page);
    await scrollBand(page, 0, 3000);
    await page.evaluate(() => {
      const pin = document.querySelector<HTMLElement>('.cbg-orbit')!, stage = document.querySelector<HTMLElement>('.cbg-orbit__stage')!;
      scrollBy(0, pin.offsetHeight - stage.offsetHeight);
    });
    const seen = await page.evaluate(() => new Promise<number[]>((done) => {
      const c = document.querySelector<HTMLElement>('.cbg-orbit__canvas')!;
      const out: number[] = [];
      const t0 = performance.now();
      (function f() {
        out.push(Number(c.dataset.frame));
        performance.now() - t0 < 1000 ? requestAnimationFrame(f) : done(out);
      })();
    }));
    expect(Math.max(...seen)).toBeLessThan(14); // a second after the jump the film is still turning (21 frames in 2.4 s at most)
  });
});

test.describe('phone, full motion', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('phones play the small frames', async ({ page }) => {
    const { frames, errors } = await open(page);
    await scrollBand(page, 0.5, 3000);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((u) => u.includes('/site-orbit/s/'))).toBe(true);
    const s = await state(page);
    expect(s.stageTop).toBe(56);
    expect(s.frame).toBeGreaterThan(6);
    expect(errors).toEqual([]);
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('the poster, still, with no sticky stretch and no frames', async ({ page }) => {
    const { frames, errors } = await open(page);
    await page.locator('#cbg-band').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    const s = await state(page);
    expect(s.pin).toBe(s.stage);
    expect(s.position).toBe('relative');
    expect(s.canvasOn).toBe(false);
    expect(frames).toHaveLength(0);
    const poster = page.locator('.cbg-orbit__poster img');
    await expect.poll(() => poster.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    await expect(page.locator('.cbg-orbit__stage')).toHaveAttribute('role', 'img');
    await expect(page.locator('.cbg-orbit__stage')).toHaveAttribute('aria-label', /construction/);
    expect(errors).toEqual([]);
  });
});
