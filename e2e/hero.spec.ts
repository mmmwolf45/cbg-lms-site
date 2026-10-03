import { readFileSync, existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// The exploding-building home hero (SPEC section 5.1.1, src/motion/explode.ts) on the home mock.
// The block names its poster and frames on the Pages base; until they are deployed, this test serves
// them from dist/ (built by npm run build).
const TYPES: Record<string, string> = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', js: 'text/javascript', css: 'text/css', json: 'application/json' };

async function localPages(page: Page, block?: RegExp) {
  await page.route('https://mmmwolf45.github.io/cbg-lms-site/**', (r) => {
    const url = r.request().url();
    const file = 'dist/' + new URL(url).pathname.replace('/cbg-lms-site/', '');
    if ((block && block.test(url)) || !existsSync(file)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ body: readFileSync(file), contentType: TYPES[file.split('.').pop()!] ?? 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } });
  });
}

const state = (page: Page) =>
  page.evaluate(() => {
    const q = (s: string) => document.querySelector<HTMLElement>(s)!;
    const box = (s: string) => q(s).getBoundingClientRect();
    const words = [...document.querySelectorAll<HTMLElement>('.cbg-w')];
    return {
      pin: q('.cbg-explode').offsetHeight,
      stage: q('.cbg-explode__stage').offsetHeight,
      stageTop: Math.round(box('.cbg-explode__stage').top),
      canvasOn: q('.cbg-explode__canvas').classList.contains('is-on'),
      ready: q('.cbg-explode__words').classList.contains('is-ready'),
      visible: getComputedStyle(q('.cbg-explode__words')).visibility,
      firstLineY: Math.round(words[0]!.getBoundingClientRect().top),
      moved: words.filter((w) => w.style.transform && !/translate\(0(\.000)?em, -?0(\.000)?em\)/.test(w.style.transform)).length,
      frame: Number(q('.cbg-explode__canvas').dataset.frame ?? -1),
    };
  });

async function scrollHero(page: Page, f: number) {
  await page.evaluate((f) => {
    const pin = document.querySelector<HTMLElement>('.cbg-explode')!, stage = document.querySelector<HTMLElement>('.cbg-explode__stage')!;
    scrollTo(0, Math.round((pin.offsetHeight - stage.offsetHeight) * f));
  }, f);
  await page.waitForTimeout(900);
}

async function openHome(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/', { waitUntil: 'load' });
  if ((await page.locator('[data-cbg-explode]').count()) === 0) test.skip(true, 'home hero not built yet');
  await expect.poll(() => page.evaluate(() => (window as { __cbg?: number }).__cbg)).toBe(1);
  return errors;
}

test.describe('laptop, full motion', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the subtitle sits between the headline and the buttons, the faint mark behind the building', async ({ page }) => {
    await localPages(page);
    await openHome(page);
    const [title, sub, btns] = await Promise.all(['.cbg-explode__title', '.cbg-explode__sub', '.cbg-explode__btns'].map((s) => page.locator(s).boundingBox()));
    expect(sub!.y).toBeGreaterThan(title!.y + title!.height);
    expect(sub!.y + sub!.height).toBeLessThanOrEqual(btns!.y);
    await expect(page.locator('.cbg-explode__sub')).toHaveText('Your courses, live class links and study materials, all in one place.');
    const mark = page.locator('.cbg-explode__mark');
    await expect.poll(() => mark.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBe(900);
    expect(await mark.evaluate((i) => getComputedStyle(i).opacity)).toBe('0.04');
    expect(await page.locator('.cbg-explode__canvas').evaluate((c) => getComputedStyle(c).mixBlendMode)).toBe('lighten');
  });

  test('one real h1 in three fixed lines; chip above, buttons below, Log in clickable', async ({ page }) => {
    await localPages(page);
    await openHome(page);
    // Screen readers get the sentence once (the split copy is aria-hidden).
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Welcome to your classroom');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('.cbg-explode__line')).toHaveCount(3);
    const [chip, title, btns] = await Promise.all(['.cbg-explode__chip', '.cbg-explode__title', '.cbg-explode__btns'].map((s) => page.locator(s).boundingBox()));
    expect(chip!.y + chip!.height).toBeLessThan(title!.y);
    expect(btns!.y).toBeGreaterThan(title!.y + title!.height);
    // The ghost button keeps its outline (a first-paint rule once made it transparent).
    expect(await page.locator('.cbg-explode__btns .cbg-btn--ghost').evaluate((b) => getComputedStyle(b).borderTopColor)).not.toBe('rgba(0, 0, 0, 0)');
    const login = page.locator('.cbg-explode__btns [data-cbg-action="login"]');
    const b = (await login.boundingBox())!;
    expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('[data-cbg-action="login"]'), [b.x + b.width / 2, b.y + b.height / 2])).toBe(true);
  });

  test('the poster is the LCP image: eager, high priority, sized', async ({ page }) => {
    await localPages(page);
    await openHome(page);
    const img = page.locator('.cbg-explode__poster img');
    await expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(await img.getAttribute('loading')).toBeNull();
    expect([await img.getAttribute('width'), await img.getAttribute('height')]).toEqual(['960', '960']);
  });

  test('scrolling plays the explosion while the stage holds, and scrolling back reassembles it', async ({ page }) => {
    await localPages(page);
    const errors = await openHome(page);
    await expect.poll(async () => (await state(page)).canvasOn).toBe(true);
    await expect.poll(async () => (await state(page)).ready).toBe(true);
    const start = await state(page);
    expect(start.pin - start.stage).toBeGreaterThan(300); // half a screen of scrolling to play it
    expect(start.moved).toBe(0);
    expect(start.visible).toBe('visible');
    await scrollHero(page, 1);
    // Wait for the end state rather than a fixed time: frames may still be arriving under load.
    await expect.poll(async () => (await state(page)).frame, { timeout: 8000 }).toBe(47);
    const end = await state(page);
    expect(end.stageTop).toBe(56); // held under the navbar
    expect(end.moved).toBeGreaterThan(3); // the headline came apart
    expect(end.firstLineY).toBeLessThan(start.firstLineY);
    expect(await page.locator('.cbg-explode__chip').evaluate((c) => getComputedStyle(c).opacity)).toBe('0'); // the chip stepped aside
    const gap = await page.evaluate(() => document.querySelector('.cbg-explode__sub')!.getBoundingClientRect().top - Math.max(...[...document.querySelectorAll('.cbg-w')].map((w) => w.getBoundingClientRect().bottom)));
    expect(gap).toBeGreaterThan(0); // "classroom" never lands on the subtitle
    expect(start.frame).toBe(0);
    expect(end.frame).toBe(47); // the last frame is on the canvas: the building fully apart
    await scrollHero(page, 0);
    await expect.poll(async () => (await state(page)).moved, { timeout: 8000 }).toBe(0);
    const back = await state(page);
    expect(back.moved).toBe(0);
    expect(Math.abs(back.firstLineY - start.firstLineY)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test('frames that fail to load leave the poster, and the headline still moves', async ({ page }) => {
    await localPages(page, /hero-explode\//);
    const errors = await openHome(page);
    await scrollHero(page, 1);
    const s = await state(page);
    expect(s.canvasOn).toBe(false);
    await expect(page.locator('.cbg-explode__poster img')).toBeVisible();
    expect(s.moved).toBeGreaterThan(3);
    expect(errors).toEqual([]);
  });
});

test('reduced motion: one screen, the assembled building and the whole headline, still', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await localPages(page);
  await openHome(page);
  await expect.poll(async () => (await state(page)).ready).toBe(true);
  const s = await state(page);
  expect(s.pin).toBe(s.stage); // no pinned stretch
  await page.evaluate(() => scrollTo(0, 300));
  await page.waitForTimeout(500);
  const after = await state(page);
  expect(after.moved).toBe(0);
  expect(after.canvasOn).toBe(false);
  await expect(page.locator('.cbg-explode__poster img')).toBeVisible();
});

test('phone: three lines fit the screen, no sideways scroll, the explosion plays', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await localPages(page);
  await openHome(page);
  const widths = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.cbg-explode__line')].map((l) => l.getBoundingClientRect().right));
  for (const r of widths) expect(r).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await scrollHero(page, 1);
  expect((await state(page)).moved).toBeGreaterThan(3);
});
