import { expect, test, type Page } from '@playwright/test';
import { withoutSky } from './no-sky';

withoutSky(); // the sky's software WebGL starves these timing tests (e2e/no-sky.ts)

// Home interactions on the mock. The mock has course.link's navbar markup but none of its JS, so clicking
// the native Login button opens nothing here: we check that our link clicks it.

const LAPTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // The mock pulls course.link's own assets from the live origin; those network failures aren't ours.
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
  });
  return errors;
}

// The card gallery is the fallback of the 3D course story (src/motion/three-sections.ts): these tests run it
// as a browser without WebGL2 sees it. The story itself: e2e/three.spec.ts.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return type === 'webgl2' ? null : (get as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof get;
  });
});

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

const pins = (page: Page) => page.locator('.pin-spacer').count();

// The pinned gallery's scroll range: where the pin starts and how far it runs.
const pinRange = (page: Page) =>
  page.evaluate(() => {
    const spacer = document.querySelector('[data-cbg-gallery]')!.parentElement!;
    const top = spacer.getBoundingClientRect().top + scrollY;
    return { top, length: spacer.getBoundingClientRect().height - innerHeight };
  });

async function scrollToY(page: Page, y: number) {
  await page.evaluate((to) => window.scrollTo(0, to), y);
  await page.waitForTimeout(900); // scrub 0.6s catches up
}

// The visual state of one course card: photo zoom (scale), tilt, gold rule (scaleX), edge light.
// IOSH's card: the first of the live cards (QS is live too since 4 Oct 2026).
const FIRST_LIVE = '.cbg-course--live >> nth=0';
const cardState = (page: Page, sel: string) =>
  page.locator(sel).evaluate((card) => {
    const scale = (t: string) => (t === 'none' ? 1 : new DOMMatrix(t).a);
    const photo = card.querySelector('.cbg-course__media > *')!;
    const img = photo.querySelector('img') ?? photo;
    return {
      zoom: scale(getComputedStyle(img).transform),
      tilt: getComputedStyle(card).transform,
      rule: scale(getComputedStyle(card.querySelector('.cbg-course__media')!, '::after').transform),
      light: getComputedStyle(card, '::after').opacity,
    };
  });

test('Log in (click) opens course.link\'s login: clicks the navbar Login button, no hash change', async ({ page }) => {
  const errors = watchErrors(page);
  await openHome(page);
  await spyLogin(page);
  await page.locator('[data-cbg-action="login"]').first().click();
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

test.describe('laptop, full motion', () => {
  test.use({ viewport: LAPTOP });
  test.beforeEach(async ({ page }) => page.emulateMedia({ reducedMotion: 'no-preference' }));

  test('the courses pin and vertical scroll pans the row until the last card is in view', async ({ page }) => {
    const errors = watchErrors(page);
    await openHome(page);
    await expect.poll(() => pins(page)).toBe(1);
    await expect(page.locator('[data-cbg-gallery]')).toHaveClass(/\bis-pan\b/);
    const { top, length } = await pinRange(page);
    expect(length).toBeGreaterThan(300);
    // The whole panel fits the screen (nothing below it that the pin would hide).
    expect(await page.locator('[data-cbg-gallery]').evaluate((s) => (s as HTMLElement).offsetHeight)).toBeLessThanOrEqual(LAPTOP.height);
    const state = () =>
      page.evaluate(() => {
        const section = document.querySelector('[data-cbg-gallery]')!.getBoundingClientRect();
        const cards = [...document.querySelectorAll('.cbg-gallery__track > li')].map((li) => li.getBoundingClientRect());
        const bar = document.querySelector('.cbg-gallery__bar i')!;
        return {
          sectionTop: section.top,
          x: new DOMMatrix(getComputedStyle(document.querySelector('.cbg-gallery__track')!).transform).e,
          first: cards[0],
          last: cards[cards.length - 1],
          bar: new DOMMatrix(getComputedStyle(bar).transform).a,
        };
      });

    await scrollToY(page, top + length / 2);
    const mid = await state();
    expect(mid.sectionTop).toBeCloseTo(0, 0); // pinned
    expect(mid.x).toBeLessThan(-100);
    expect(mid.bar).toBeGreaterThan(0.2);
    expect(mid.bar).toBeLessThan(0.8);

    await scrollToY(page, top + length);
    await expect.poll(async () => (await state()).bar, { timeout: 3000 }).toBeGreaterThan(0.99);
    const end = await state();
    expect(end.last.left).toBeGreaterThanOrEqual(0);
    expect(end.last.right).toBeLessThanOrEqual(LAPTOP.width);
    expect(end.first.right).toBeLessThan(0); // the first card has panned off to the left
    expect(errors).toEqual([]);
  });

  test('live card hover: the photo zooms, the card tilts, the gold rule runs and the edge lights', async ({ page }) => {
    const errors = watchErrors(page);
    await openHome(page);
    await expect.poll(() => pins(page)).toBe(1);
    await scrollToY(page, (await pinRange(page)).top);
    await expect(page.locator('.cbg-gallery__track')).toHaveClass(/cbg-done/, { timeout: 5000 });
    const sel = FIRST_LIVE;
    await page.mouse.move(5, 5);
    const rest = await cardState(page, sel);
    expect(rest.zoom).toBe(1);
    expect(rest.light).toBe('0');

    const box = (await page.locator(sel).boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.2, { steps: 4 });
    await page.waitForTimeout(1000); // the zoom runs 0.8s
    const hover = await cardState(page, sel);
    expect(hover.zoom).toBeGreaterThan(1.04);
    expect(hover.zoom).toBeLessThanOrEqual(1.06);
    expect(hover.tilt).toMatch(/^matrix3d/);
    expect(hover.rule).toBeCloseTo(1, 2);
    expect(hover.light).toBe('1');
    // Tilt at most ~4deg: the card's own rotation.
    const deg = await page.locator(sel).evaluate((el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return Math.max(Math.abs(Math.asin(m.m13)), Math.abs(Math.asin(m.m23))) * (180 / Math.PI);
    });
    expect(deg).toBeGreaterThan(0.5);
    expect(deg).toBeLessThanOrEqual(4.01);

    await page.mouse.move(5, 5, { steps: 4 });
    await expect.poll(async () => (await cardState(page, sel)).zoom, { timeout: 3000 }).toBe(1);
    expect(errors).toEqual([]);
  });

  test('coming-soon card hover: nothing moves or lights (it is not a link)', async ({ page }) => {
    await openHome(page);
    await expect.poll(() => pins(page)).toBe(1);
    await scrollToY(page, (await pinRange(page)).top);
    await expect(page.locator('.cbg-gallery__track')).toHaveClass(/cbg-done/, { timeout: 5000 });
    const sel = '.cbg-course--soon >> nth=0';
    const box = (await page.locator(sel).boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.2, { steps: 4 });
    await page.waitForTimeout(1000);
    const s = await cardState(page, sel);
    expect(s).toEqual({ zoom: 1, tilt: 'none', rule: s.rule, light: '0' });
    expect(s.rule).toBeLessThan(0.2); // the short rest length
    expect(await page.locator(sel).evaluate((el) => getComputedStyle(el).translate)).toBe('none');
  });

  test('keyboard focus on the live card zooms its photo and runs the rule, and survives a re-pin', async ({ page }) => {
    await openHome(page);
    await expect.poll(() => pins(page)).toBe(1);
    await page.locator(FIRST_LIVE).locator('a').focus();
    await page.setViewportSize({ width: LAPTOP.width, height: LAPTOP.height - 20 }); // ScrollTrigger refreshes: unpins, pins again
    await page.waitForTimeout(600);
    await expect(page.locator(FIRST_LIVE).locator('a')).toBeFocused(); // put back after the re-pin
    await expect.poll(async () => (await cardState(page, FIRST_LIVE)).zoom).toBeGreaterThan(1.04);
    await expect.poll(async () => (await cardState(page, FIRST_LIVE)).rule).toBeCloseTo(1, 2);
  });

  test('route change: the gallery sets up again with one pin and no errors', async ({ page }) => {
    const errors = watchErrors(page);
    await openHome(page);
    await expect.poll(() => pins(page)).toBe(1);
    for (const path of ['/login', '/']) {
      await page.evaluate((p) => history.pushState(null, '', p), path);
      await page.waitForTimeout(300); // router debounce is 100 ms
    }
    await expect.poll(() => pins(page)).toBe(1);
    expect(errors).toEqual([]);
  });

  test('home chunk arrives after the reader scrolled past the gallery: nothing on screen moves', async ({ page }) => {
    // (A programmatic scroll that follows the pin spacer down keeps the view still but Chrome still counts it
    // as a shift, so the gallery instead waits to pin until the reader is back above it.)
    // Hold the home chunk back until the page is scrolled to the support section.
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route('**/cbg-lms-site/cbg-home.*.js', async (route) => {
      await held;
      await route.continue();
    });
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
          if (!e.hadRecentInput) w.__cls += e.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await openHome(page);
    const heading = page.locator('#cbg-support h2');
    await page.locator('#cbg-support').evaluate((s) => s.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await expect(page.locator('#cbg-support [data-cbg-reveal]')).toHaveClass(/cbg-done/, { timeout: 5000 });
    await page.waitForTimeout(600);
    expect(await pins(page)).toBe(0);
    const top = () => heading.evaluate((h) => h.getBoundingClientRect().top);
    const before = await top();
    await page.evaluate(() => ((window as unknown as { __cls: number }).__cls = 0));
    const chunk = page.waitForResponse('**/cbg-lms-site/cbg-home.*.js');
    release();
    await chunk;
    await page.waitForTimeout(1500); // past the idle setup
    expect(Math.abs((await top()) - before)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
    expect(await pins(page)).toBe(0); // the grid, until the reader is back above the section
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect.poll(() => pins(page)).toBe(1);
  });
});

test('a laptop screen too short for the pinned panel keeps the grid: no pin, every card on screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 760 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  await page.waitForTimeout(1500); // past the idle setup
  expect(await pins(page)).toBe(0);
  await expect(page.locator('[data-cbg-gallery]')).not.toHaveClass(/\bis-pan\b/);
  const off = await page.$$eval('.cbg-gallery__track > li', (lis) =>
    lis.filter((li) => { const r = li.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }).length);
  expect(off).toBe(0);
});

test('coming-soon cards are not links; each live card is one link over its whole area', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.emulateMedia({ reducedMotion: 'reduce' }); // a still grid, so points are stable
  await openHome(page);
  expect(await page.locator('.cbg-course--soon').count()).toBe(4);
  expect(await page.locator('.cbg-course--soon a, .cbg-course--soon button').count()).toBe(0);
  const hrefs = [];
  for (const live of await page.locator('.cbg-course--live').all()) {
    await live.scrollIntoViewIfNeeded();
    hrefs.push(await live.locator('h3').evaluate((h) => {
      const r = h.getBoundingClientRect();
      return document.elementFromPoint(r.left + 10, r.top + r.height / 2)?.closest('a')?.getAttribute('href');
    }));
  }
  expect(hrefs).toEqual(['/course/101-iosh-level3-certificate', '/course/102-quantity-surveying']);
});

test('reduced motion: no pin, no zoom, no tilt; the strip stands still', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  await page.waitForTimeout(500);
  expect(await pins(page)).toBe(0);
  const card = page.locator(FIRST_LIVE);
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await page.waitForTimeout(300);
  const s = await cardState(page, FIRST_LIVE);
  expect(s.zoom).toBe(1);
  expect(s.tilt).toBe('none');
  const strip = await page.evaluate(() => ({
    animation: getComputedStyle(document.querySelector('.cbg-marquee__track')!).animationName,
    sets: [...document.querySelectorAll('.cbg-marquee__set')].filter((el) => getComputedStyle(el).display !== 'none').length,
  }));
  expect(strip).toEqual({ animation: 'none', sets: 1 });
});

test('the disciplines strip moves only with scroll; nothing else on the page loops on a clock', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  expect(await page.locator('.cbg-marquee').count()).toBe(1);
  await expect(page.locator('#cbg-disciplines')).toHaveAttribute('aria-hidden', 'true');
  const track = page.locator('.cbg-marquee__track');
  expect(await track.evaluate((t) => [getComputedStyle(t).animationName, getComputedStyle(t).animationTimeline])).toEqual(['cbg-marquee', 'view()']);
  const x = () => track.evaluate((t) => new DOMMatrix(getComputedStyle(t).transform).e);
  const y = await page.locator('#cbg-disciplines').evaluate((d) => d.getBoundingClientRect().top + scrollY);
  await page.evaluate((t) => window.scrollTo(0, t), y - 700);
  await page.waitForTimeout(300);
  const before = await x();
  await page.waitForTimeout(1000);
  expect(await x()).toBe(before); // still while the page is still
  await page.evaluate((t) => window.scrollTo(0, t), y - 100);
  await page.waitForTimeout(300);
  const after = await x();
  expect(after).toBeLessThan(before - 50); // drifts left as the page scrolls down
  expect(after).toBeGreaterThan(before - LAPTOP.width / 4 - 1); // a quarter of the screen at most
  // The one CSS loop allowed: the support card's slow border light (approved 6 Oct 2026, paused off screen).
  const loops = await page.evaluate(() => document.getAnimations()
    .filter((a) => a.effect?.getTiming().iterations === Infinity && (a as CSSAnimation).animationName !== 'cbg-beam').length);
  expect(loops).toBe(0);
});

test('the facts count up to the course data; reduced motion shows the final numbers', async ({ page }) => {
  const read = () => page.locator('.cbg-stat [data-cbg-count]').allTextContents();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  expect(await read()).toEqual(['6', '4']);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  await page.locator('#cbg-facts').scrollIntoViewIfNeeded();
  await expect.poll(read, { timeout: 4000 }).toEqual(['6', '4']);
  await expect(page.locator('.cbg-stat .cbg-sr-only')).toHaveText(['6', '4']);
});

test.describe('phone', () => {
  test.use({ viewport: PHONE });

  test('the course row is a labelled region that swipes and scrolls with the arrow keys; nothing pins', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openHome(page);
    await page.waitForTimeout(500);
    expect(await pins(page)).toBe(0);
    const row = page.getByRole('region', { name: 'Your courses' });
    await row.scrollIntoViewIfNeeded();
    expect(await row.evaluate((r) => r.scrollWidth > r.clientWidth + 600)).toBe(true);
    await row.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => row.evaluate((r) => r.scrollLeft)).toBeGreaterThan(100);
    // Settles snapped to the next card's start, one gutter (16px) in from the screen edge.
    await expect.poll(() => row.evaluate((r) => Math.round(r.querySelectorAll('.cbg-gallery__track > li')[1].getBoundingClientRect().left))).toBe(16);
  });

  test('touch: tapping a coming-soon card does nothing special (no tilt, no navigation)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true, baseURL: 'http://localhost:4173' });
    const page = await ctx.newPage();
    await page.addInitScript(() => { // the gallery fallback, as in beforeEach (a new context needs its own)
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return type === 'webgl2' ? null : (get as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof get;
    });
    await openHome(page);
    const card = page.locator('.cbg-course--soon').first();
    await card.scrollIntoViewIfNeeded();
    const url = page.url();
    await card.locator('h3').tap();
    await page.waitForTimeout(400);
    expect(page.url()).toBe(url);
    expect(await card.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    await ctx.close();
  });
});
