import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

// T20, read-only on the real course page. Nothing on course.link changes: only this test browser's
// copy of the HTML response gets the route classes on <html> and a <style> holding the CONTENTS
// of the locally built CSS (dist/manifest.json -> dist/<css>; run `npm run build` first). No login,
// no clicks outside the accordion. Checks that course.link's own behaviour survives the restyle.
const URL = 'https://cbgtraininginstitute.course.link/course/preview-101';
const SCREENS = 'test-results/screens';
const DARK = 'rgb(8, 18, 38)';

function builtCss(): string {
  const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8')) as { css: string };
  return readFileSync(`dist/${manifest.css}`, 'utf8');
}

async function openInjected(page: Page) {
  const css = builtCss();
  // The loader is already pasted into course.link's Custom Script slot, and it fetches the
  // DEPLOYED bundle from GitHub Pages, whose (older) tokens would override ours; aborting it
  // would trip the loader's fail-safe and strip the route class. So, in this browser only, the
  // Pages base answers from the local dist/ instead.
  await page.route('https://mmmwolf45.github.io/cbg-lms-site/**', async (route) => {
    const file = `dist/${new globalThis.URL(route.request().url()).pathname.replace(/^\/cbg-lms-site\//, '')}`;
    if (existsSync(file) && !file.endsWith('/')) await route.fulfill({ path: file });
    else await route.fulfill({ status: 404, body: 'not in local dist' });
  });
  await page.route(URL, async (route) => {
    const res = await route.fetch();
    const html = (await res.text())
      .replace(/<html\b([^>]*)>/i, (_m, attrs: string) =>
        /\bclass="/.test(attrs)
          ? `<html${attrs.replace(/\bclass="/, 'class="cbg-js cbg-route-course ')}>`
          : `<html${attrs} class="cbg-js cbg-route-course">`,
      )
      .replace('</head>', () => `<style id="cbg-t20-test">${css}</style></head>`);
    const headers = { ...res.headers() };
    delete headers['content-length'];
    delete headers['content-encoding'];
    await route.fulfill({ response: res, body: html, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect(page.locator('#course_content h3').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.className)).toContain('cbg-route-course');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(DARK);
}

// The enrol card has no id: it is the element right after the column holding #course_content.
const card = (page: Page) => page.locator('div:has(> #course_content) + div');
const triggers = (page: Page) => page.locator('#course_content h3').getByRole('button');
// A trigger's item: the h3's parent; its panel is the item's region (found by role, not Radix id).
const panelOf = (trigger: Locator) => trigger.locator('xpath=ancestor::h3[1]/..').getByRole('region');

const contrast = (loc: Locator) =>
  loc.evaluate((el) => {
    type C = [number, number, number, number];
    const parse = (s: string): C => {
      const m = s.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      return [m[0], m[1], m[2], m[3] ?? 1];
    };
    const over = (top: C, base: C): C => [0, 1, 2].map((i) => top[i] * top[3] + base[i] * (1 - top[3])).concat(1) as C;
    const layersOf = (n: Element): C[] => {
      const cs = getComputedStyle(n);
      const solid = [...cs.backgroundImage.matchAll(/linear-gradient\((rgba?\([^)]*\)), (rgba?\([^)]*\))\)/g)]
        .filter((m) => m[1] === m[2])
        .map((m) => parse(m[1]));
      return [parse(cs.backgroundColor), ...solid.reverse()];
    };
    const stack: C[][] = [];
    for (let n: Element | null = el; n; n = n.parentElement) stack.push(layersOf(n));
    const bg = stack.reverse().flat().reduce((acc, layer) => over(layer, acc), [255, 255, 255, 1] as C);
    const fg = over(parse(getComputedStyle(el).color), bg);
    const lum = (c: C) =>
      [0, 1, 2]
        .map((i) => c[i] / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
    return { bgLum: lum(bg), ratio: (hi + 0.05) / (lo + 0.05) };
  });

test.describe('live course page with our CSS injected (test browser only)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('accordion: the first section opens and closes; Expand all sections still works', async ({ page }) => {
    await openInjected(page);
    const first = triggers(page).first();
    const start = await first.getAttribute('aria-expanded');
    const flip = start === 'true' ? 'false' : 'true';

    await first.click();
    await expect(first).toHaveAttribute('aria-expanded', flip);
    if (flip === 'true') await expect(panelOf(first)).toBeVisible();
    else await expect(panelOf(first)).toBeHidden();

    await first.click();
    await expect(first).toHaveAttribute('aria-expanded', start ?? 'false');
    if (start === 'true') await expect(panelOf(first)).toBeVisible();
    else await expect(panelOf(first)).toBeHidden();

    // Opened state: the panel is visible and its lesson rows read at AA on the dark wrapper.
    if ((await first.getAttribute('aria-expanded')) !== 'true') await first.click();
    await expect(panelOf(first)).toBeVisible();
    const lesson = panelOf(first).getByRole('button').first().locator('p');
    expect((await contrast(lesson)).ratio).toBeGreaterThanOrEqual(4.5);
    expect((await contrast(first.locator('h6'))).ratio).toBeGreaterThanOrEqual(4.5);
    expect((await contrast(first)).bgLum).toBeLessThan(0.02);

    // Expand all: every section ends up open (whatever the start state).
    await page.locator('#course_content').getByRole('button', { name: /expand all sections/i }).click();
    const n = await triggers(page).count();
    expect(n).toBeGreaterThan(1);
    for (let i = 0; i < n; i++) await expect(triggers(page).nth(i)).toHaveAttribute('aria-expanded', 'true');
    for (let i = 0; i < n; i++) await expect(panelOf(triggers(page).nth(i))).toBeVisible();

    mkdirSync(SCREENS, { recursive: true });
    await page.screenshot({ path: `${SCREENS}/native-course-live-1440.png` });
    await page.locator('#course_content').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SCREENS}/native-course-live-1440-content.png` });
  });

  test('enrol card stays sticky while scrolling and reads at AA', async ({ page }) => {
    await openInjected(page);
    // Open everything so the main column is long enough to scroll past the card.
    await page.locator('#course_content').getByRole('button', { name: /expand all sections/i }).click();
    const c = card(page);
    await expect(c).toBeVisible();
    expect(await c.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
    expect((await contrast(c)).bgLum).toBeLessThan(0.02);
    for (const loc of [c.locator('h5'), c.getByRole('button').first(), c.locator('li').first()]) {
      expect((await contrast(loc)).ratio).toBeGreaterThanOrEqual(4.5);
    }

    const tops: number[] = [];
    for (const y of [900, 1600, 2400]) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(150);
      tops.push(Math.round((await c.boundingBox())!.y));
    }
    expect(tops).toEqual([72, 72, 72]); // lg:top-[4.5rem], pinned while the column scrolls
  });
});

test('phone: the bottom bar shows, is dark and readable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openInjected(page);
  await page.evaluate(() => window.scrollTo(0, 900));
  const c = card(page);
  await expect(c).toBeVisible();
  await expect.poll(() => c.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
  await expect.poll(async () => Math.round((await c.boundingBox())!.y + (await c.boundingBox())!.height)).toBe(844);
  expect((await contrast(c)).bgLum).toBeLessThan(0.02);
  const button = c.getByRole('button').first();
  await expect(button).toBeVisible();
  expect((await contrast(button)).ratio).toBeGreaterThanOrEqual(4.5);
  mkdirSync(SCREENS, { recursive: true });
  await page.screenshot({ path: `${SCREENS}/native-course-live-390.png` });
});
