import { expect, test, type Page } from '@playwright/test';

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
    const { top, length } = await pinRange(page);
    expect(length).toBeGreaterThan(300);
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

  test('card hover: the photo zooms, the card tilts, the gold rule runs and the edge lights', async ({ page }) => {
    const errors = watchErrors(page);
    await openHome(page);
    await expect.poll(() => pins(page)).toBe(1);
    await scrollToY(page, (await pinRange(page)).top);
    await expect(page.locator('.cbg-gallery__track')).toHaveClass(/cbg-done/, { timeout: 5000 });
    const sel = '.cbg-course--soon >> nth=0';
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

  test('keyboard focus on the live card zooms its photo and runs the rule', async ({ page }) => {
    await openHome(page);
    await page.locator('.cbg-course--live a').focus();
    await page.waitForTimeout(300);
    await expect(page.locator('.cbg-course--live a')).toBeFocused(); // kept when the section pins
    await expect.poll(async () => (await cardState(page, '.cbg-course--live')).zoom).toBeGreaterThan(1.04);
    await expect.poll(async () => (await cardState(page, '.cbg-course--live')).rule).toBeCloseTo(1, 2);
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
});

test('coming-soon cards are not links; the live card is one link over its whole area', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.emulateMedia({ reducedMotion: 'reduce' }); // a still grid, so points are stable
  await openHome(page);
  expect(await page.locator('.cbg-course--soon').count()).toBe(5);
  expect(await page.locator('.cbg-course--soon a, .cbg-course--soon button').count()).toBe(0);
  const live = page.locator('.cbg-course--live');
  await live.scrollIntoViewIfNeeded();
  const href = await live.locator('h3').evaluate((h) => {
    const r = h.getBoundingClientRect();
    return document.elementFromPoint(r.left + 10, r.top + r.height / 2)?.closest('a')?.getAttribute('href');
  });
  expect(href).toBe('/course/101-iosh-level3-certificate');
});

test('reduced motion: no pin, no zoom, no tilt; the strip stands still', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  await page.waitForTimeout(500);
  expect(await pins(page)).toBe(0);
  const card = page.locator('.cbg-course--soon').first();
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await page.waitForTimeout(300);
  const s = await cardState(page, '.cbg-course--soon >> nth=0');
  expect(s.zoom).toBe(1);
  expect(s.tilt).toBe('none');
  const strip = await page.evaluate(() => ({
    animation: getComputedStyle(document.querySelector('.cbg-marquee__track')!).animationName,
    sets: [...document.querySelectorAll('.cbg-marquee__set')].filter((el) => getComputedStyle(el).display !== 'none').length,
  }));
  expect(strip).toEqual({ animation: 'none', sets: 1 });
});

test('the disciplines strip: one marquee, hidden from screen readers, paused under the mouse', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  expect(await page.locator('.cbg-marquee').count()).toBe(1);
  await expect(page.locator('#cbg-disciplines')).toHaveAttribute('aria-hidden', 'true');
  const play = () => page.locator('.cbg-marquee__track').evaluate((t) => [getComputedStyle(t).animationName, getComputedStyle(t).animationPlayState]);
  expect(await play()).toEqual(['cbg-marquee', 'running']);
  await page.locator('.cbg-marquee').hover();
  expect(await play()).toEqual(['cbg-marquee', 'paused']);
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

test('the photo band drifts with scroll (full motion only)', async ({ page }) => {
  // The band photo isn't built yet, so put a band in the served page, as the template renders it.
  await page.route('http://localhost:4173/', async (route) => {
    const res = await route.fetch();
    const img = 'https://mmmwolf45.github.io/cbg-lms-site/img/closing-plate-1536.jpg';
    const band = `<section id="cbg-band" class="cbg-section cbg-band" data-cbg-section="band" data-cbg-parallax><div class="cbg-wrap"><div class="cbg-band__view"><picture class="cbg-band__media"><img src="${img}" width="1536" height="1024" alt=""></picture></div></div></section>`;
    await route.fulfill({ response: res, body: (await res.text()).replace('<section id="cbg-courses"', `${band}<section id="cbg-courses"`) });
  });
  const drift = async () => {
    const y = await page.locator('#cbg-band').evaluate((b) => b.getBoundingClientRect().top + scrollY);
    const at = async (to: number) => {
      await page.evaluate((t) => window.scrollTo(0, t), to);
      await page.waitForTimeout(300);
      return page.locator('.cbg-band__media').evaluate((m) => new DOMMatrix(getComputedStyle(m).transform).f);
    };
    return [await at(y - 700), await at(y)];
  };
  await page.setViewportSize(LAPTOP);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  const [a, b] = await drift();
  expect(b).toBeGreaterThan(a + 5);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  expect(await drift()).toEqual([0, 0]);
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
