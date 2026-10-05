import { readFileSync, existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { withoutSky } from './no-sky';

withoutSky(); // the sky's software WebGL starves these timing tests (e2e/no-sky.ts)

// The courses story (SPEC section 5.1, src/motion/course-story.ts) on the home mock: the section holds while
// each chapter shows one card beside its course film. The block names the films on the Pages base; this
// test serves them from dist/ (or fails them, to check the fallback).
const TYPES: Record<string, string> = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg' };
const FILM = /\/course-films\//;

// slow: requests matching it answer 300 ms late, like a slow network.
async function open(page: Page, films: 'serve' | 'fail' = 'serve', slow?: RegExp) {
  const frames: string[] = [];
  const errors: string[] = [];
  const order: string[] = []; // every film and band frame, in request order
  await page.route('https://mmmwolf45.github.io/cbg-lms-site/**', async (r) => {
    const url = r.request().url();
    const file = 'dist/' + new URL(url).pathname.replace('/cbg-lms-site/', '');
    if (FILM.test(url)) frames.push(url);
    if (/\/(course-films|site-orbit)\/.*\/f\d+\.avif$/.test(url)) order.push(url);
    if (slow?.test(url)) await new Promise((d) => setTimeout(d, 300));
    if (!existsSync(file) || (films === 'fail' && FILM.test(url))) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ body: readFileSync(file), contentType: TYPES[file.split('.').pop()!] ?? 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } });
  });
  page.on('pageerror', (e) => errors.push(e.message));
  // The mock pulls course.link's own assets from the live origin; those network failures (and the films
  // this spec fails on purpose) aren't errors of ours.
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));
  await page.goto('/', { waitUntil: 'load' });
  if ((await page.locator('[data-cbg-story]').count()) === 0) test.skip(true, 'story not built yet');
  await expect.poll(() => page.evaluate(() => (window as { __cbg?: number }).__cbg)).toBe(1);
  return { frames, errors, order };
}

const state = (page: Page) =>
  page.evaluate(() => {
    const s = document.querySelector<HTMLElement>('[data-cbg-story]')!;
    const c = s.querySelector<HTMLCanvasElement>('.cbg-story__canvas')!;
    const lis = [...s.querySelectorAll<HTMLElement>('.cbg-gallery__track > li')];
    return {
      story: s.classList.contains('is-story'),
      height: s.offsetHeight,
      panelTop: Math.round(s.querySelector('.cbg-wrap')!.getBoundingClientRect().top),
      chapter: Number(c.dataset.chapter ?? -1),
      frame: Number(c.dataset.frame ?? -1),
      on: c.classList.contains('is-on'),
      active: lis.findIndex((li) => li.classList.contains('is-current')),
      shown: lis.filter((li) => Number(getComputedStyle(li).opacity) > 0.01).length,
      n: lis.length,
    };
  });

// Scroll to the middle of chapter k (its resting point; a fraction is a point inside chapter floor(k)), in
// small steps like a wheel, then let the story settle. The settle moves at most one chapter from the last one
// (6 Oct 2026), so further chapters are reached a chapter at a time (walk below).
async function scrollStory(page: Page, k: number, settle = 3000) {
  await page.evaluate(async (k) => {
    const s = document.querySelector<HTMLElement>('[data-cbg-story]')!, w = s.querySelector<HTMLElement>('.cbg-wrap')!;
    const n = s.querySelectorAll('.cbg-gallery__track > li').length;
    const y = scrollY + s.getBoundingClientRect().top - 56 + ((k + 0.5) / n) * (s.offsetHeight - w.offsetHeight);
    const y0 = scrollY;
    for (let i = 1; i <= 20; i++) {
      scrollTo(0, Math.round(y0 + ((y - y0) * i) / 20));
      await new Promise((r) => requestAnimationFrame(r));
    }
  }, k);
  await page.waitForTimeout(settle);
}
async function walk(page: Page, to: number, settle = 1500) {
  for (let k = 1; k <= to; k++) await scrollStory(page, k, settle);
}
const chapterPx = (page: Page) =>
  page.evaluate(() => {
    const s = document.querySelector<HTMLElement>('[data-cbg-story]')!, w = s.querySelector<HTMLElement>('.cbg-wrap')!;
    return (s.offsetHeight - w.offsetHeight) / s.querySelectorAll('.cbg-gallery__track > li').length;
  });

test.describe('laptop, full motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });

  test('films load only near; the story holds and its chapters follow the scroll, one card at a time', async ({ page }) => {
    const { frames, errors } = await open(page);
    await page.waitForTimeout(1500);
    expect(frames, 'no course films at the top of the page').toHaveLength(0);
    const s0 = await state(page);
    expect(s0.story).toBe(true);
    // 0.6 of a screen of scroll per course, plus the panel's own screen (6 Oct 2026; a screen per course before).
    expect(s0.height).toBeGreaterThan(900 * (0.6 * s0.n + 0.8));
    expect(s0.height).toBeLessThan(900 * (0.6 * s0.n + 1.1));

    await scrollStory(page, 0, 4000);
    expect(frames.length).toBeGreaterThan(0);
    // The active film and the next (IOSH, then QS; when this was written QS had no film yet).
    expect(frames.every((u) => /\/course-films\/(iosh|qs)\/l\//.test(u))).toBe(true);
    // The nearest loaded frame shows until the rest decode; with the suite's parallel workers decoding six
    // films and the band, that can outlast the settle, and loading speed isn't what this checks.
    await expect.poll(async () => (await state(page)).frame, { timeout: 15000 }).toBeGreaterThan(10); // half way through IOSH's 40 frames
    const a = await state(page);
    expect(a.panelTop).toBe(56);
    expect(a).toMatchObject({ chapter: 0, active: 0, shown: 1, on: true });
    expect(a.frame).toBeLessThan(30);

    await scrollStory(page, 1, 4000);
    const b = await state(page);
    expect(b.panelTop).toBe(56);
    expect(b).toMatchObject({ chapter: 1, active: 1, shown: 1, on: true });

    for (let k = 2; k < a.n; k++) await scrollStory(page, k, k < a.n - 1 ? 1500 : 4000); // a chapter per settle
    const c = await state(page);
    expect(c.panelTop).toBe(56);
    expect(c).toMatchObject({ chapter: a.n - 1, active: a.n - 1, shown: 1 });

    await page.evaluate(() => scrollBy(0, 1200));
    await page.waitForTimeout(300);
    expect((await state(page)).panelTop).toBeLessThan(0); // released: it scrolls away with the page
    expect(errors).toEqual([]);
  });

  test('scrolling back plays the film backwards, a frame at a time', async ({ page }) => {
    const { frames } = await open(page);
    await scrollStory(page, 0, 2000); // chapter 0 at rest, half way through its film
    // The whole film first: until then the nearest loaded frame stands in (every 4th, by design).
    await expect.poll(() => new Set(frames).size, { timeout: 15000 }).toBeGreaterThanOrEqual(40);
    await page.waitForTimeout(1000);
    const seen = await page.evaluate(() => new Promise<number[]>((done) => {
      const c = document.querySelector<HTMLElement>('.cbg-story__canvas')!;
      const out: number[] = [];
      const t0 = performance.now();
      scrollBy(0, -200); // then the settle carries it on back to the story's start
      (function f() {
        out.push(Number(c.dataset.frame));
        performance.now() - t0 < 1500 ? requestAnimationFrame(f) : done(out);
      })();
    }));
    expect(seen.at(-1)!).toBeLessThan(seen[0]!);
    // Never jumpy: no step between drawn frames is more than a few frames.
    const steps = seen.slice(1).map((v, i) => Math.abs(v - seen[i]!));
    expect(Math.max(...steps)).toBeLessThanOrEqual(3);
  });

  test('keyboard focus on a waiting card scrolls the story to its chapter', async ({ page }) => {
    const { errors } = await open(page);
    await scrollStory(page, 0);
    const link = page.locator('.cbg-gallery__track > li').nth(1).locator('a');
    await link.focus();
    await expect(link).toBeFocused();
    await expect.poll(async () => (await state(page)).active).toBe(1);
    await page.waitForTimeout(1200);
    const s = await state(page);
    expect(s).toMatchObject({ chapter: 1, shown: 1, panelTop: 56 });
    expect(await link.evaluate((a) => { const r = a.getBoundingClientRect(); return r.top > 56 && r.bottom < innerHeight; })).toBe(true);
    expect(errors).toEqual([]);
  });

  test('a film that cannot load: the card gallery and its gold track instead', async ({ page }) => {
    const { errors } = await open(page, 'fail');
    await scrollStory(page, -1.5, 2000); // a screen above the story: it starts loading, the first film fails
    expect((await state(page)).story).toBe(false);
    await expect(page.locator('.cbg-track__node')).not.toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a film that fails once the reader is past the story: the story stays put (no jump), photos instead', async ({ page }) => {
    const { errors } = await open(page, 'fail');
    const support = page.locator('#cbg-support');
    await support.scrollIntoViewIfNeeded(); // straight past the story: it is near, so it loads its last film
    const top = await support.evaluate((e) => e.getBoundingClientRect().top);
    await page.waitForTimeout(2000);
    expect((await state(page)).story).toBe(true); // the gallery would make the page 3,000 px shorter above the reader
    expect(await support.evaluate((e) => e.getBoundingClientRect().top)).toBeCloseTo(top, 0);
    expect(errors).toEqual([]);
  });

  test('on a slow network the films wait for the band, which is on screen first', async ({ page }) => {
    const { order } = await open(page, 'serve', /\/site-orbit\//);
    await scrollStory(page, -1.5, 0); // the band's end: the story is a screen away
    const count = (dir: string) => order.filter((u) => u.includes(dir)).length;
    await expect.poll(() => count('/site-orbit/') === 22 && count('/course-films/') > 10, { timeout: 30000 }).toBe(true);
    const lastBand = order.map((u) => u.includes('/site-orbit/')).lastIndexOf(true);
    const firstRest = order.findIndex((u) => u.includes('/course-films/') && !u.endsWith('/f01.avif'));
    expect(firstRest).toBeGreaterThan(lastBand); // only each film's frame 1 may go first
  });

  // Since 6 Oct 2026 the story moves a chapter per settle (no jump to the last chapter by scrolling), so the
  // reader steps on quickly instead: the films left behind stop, the one reached completes.
  test('stepping ahead: the films of chapters left behind stop loading, the film reached completes', async ({ page }) => {
    const { frames } = await open(page, 'serve', /\/course-films\//);
    await scrollStory(page, 0, 1500); // IOSH (and QS's frame 1) start loading
    const n = (await state(page)).n;
    await walk(page, n - 1, 900);
    const count = (film: string) => new Set(frames.filter((u) => u.includes(`/course-films/${film}/`))).size;
    await expect.poll(() => count('interior'), { timeout: 30000 }).toBe(40);
    expect(count('iosh')).toBeLessThan(40);
  });

  test('the settle: a flick shows the next course and never skips one; a nudge glides back', async ({ page }) => {
    const { errors } = await open(page);
    await scrollStory(page, 0, 2500);
    const px = await chapterPx(page);
    const y0 = await page.evaluate(() => scrollY);
    // Record the chapters shown while one quick flick worth three chapters runs, and until it has settled.
    const seen = page.evaluate(() => new Promise<number[]>((done) => {
      const c = document.querySelector<HTMLElement>('.cbg-story__canvas')!;
      const out: number[] = [];
      const t0 = performance.now();
      (function f() {
        out.push(Number(c.dataset.chapter));
        performance.now() - t0 < 4000 ? requestAnimationFrame(f) : done(out);
      })();
    }));
    await page.mouse.move(720, 450);
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, (px * 3) / 6);
      await page.waitForTimeout(20);
    }
    expect(Math.max(...(await seen))).toBe(1); // the next course showed; the two after it never did
    const s1 = await state(page);
    expect(s1).toMatchObject({ chapter: 1, active: 1, shown: 1, panelTop: 56 });
    expect(Math.abs((await page.evaluate(() => scrollY)) - (y0 + px))).toBeLessThan(4); // resting at chapter 1's middle

    await page.mouse.wheel(0, px * 0.06); // a nudge: settles back
    await page.waitForTimeout(2000);
    expect(Math.abs((await page.evaluate(() => scrollY)) - (y0 + px))).toBeLessThan(4);
    await page.mouse.wheel(0, px * 0.3); // a third of a chapter on: the settle carries it to the next one
    await page.waitForTimeout(2500);
    expect(Math.abs((await page.evaluate(() => scrollY)) - (y0 + 2 * px))).toBeLessThan(4);
    expect((await state(page)).active).toBe(2);
    expect(errors).toEqual([]);
  });
});

test.describe('phone, full motion', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });

  test('phones play the small frames; the card sits below the film', async ({ page }) => {
    const { frames, errors } = await open(page);
    await scrollStory(page, 0, 4000);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((u) => /\/course-films\/(iosh|qs)\/s\//.test(u))).toBe(true); // the active film and the next
    const s = await state(page);
    expect(s).toMatchObject({ chapter: 0, active: 0, shown: 1, panelTop: 56, on: true });
    const [film, card] = await page.evaluate(() => [
      document.querySelector('.cbg-story__film')!.getBoundingClientRect().bottom,
      document.querySelector('.cbg-gallery__track > li.is-current')!.getBoundingClientRect().top,
    ]);
    expect(card).toBeGreaterThanOrEqual(film - 1);
    expect(errors).toEqual([]);
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('the card gallery with its gold track, no story, no films', async ({ page }) => {
    const { frames, errors } = await open(page);
    await page.locator('#cbg-courses').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    const s = await state(page);
    expect(s.story).toBe(false);
    expect(s.shown).toBe(s.n);
    expect(await page.locator('.cbg-story__stage').evaluate((e) => getComputedStyle(e).display)).toBe('none');
    await expect(page.locator('.cbg-track__node')).toHaveCount(s.n);
    expect(frames).toHaveLength(0);
    expect(errors).toEqual([]);
  });
});
