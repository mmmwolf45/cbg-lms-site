import { expect, test, type Page, type Route } from '@playwright/test';

// T13: course.link's own chrome (body, #navbar) goes dark on the home route only.
const DARK = 'rgb(8, 18, 38)'; // --cbg-bg
const BUNDLE_JS = '**/cbg-lms-site/cbg.*.js';
const BUNDLE_CSS = '**/cbg-lms-site/cbg.*.css';

const htmlClass = (page: Page) => page.evaluate(() => document.documentElement.className);
const style = (page: Page, sel: string, prop: string) =>
  page.locator(sel).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
// Only the main CSS sets backdrop-filter, so this tells us it has been applied.
const mainCssApplied = (page: Page) => style(page, '#navbar', 'backdrop-filter');

// Effective colours of an element as painted: its text colour and its background, each composited
// over the backgrounds of its ancestors (down to the white canvas), then the WCAG contrast ratio.
function paint(page: Page, sel: string) {
  return page.locator(sel).first().evaluate((el) => {
    type C = [number, number, number, number];
    const parse = (s: string): C => {
      const m = s.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      return [m[0], m[1], m[2], m[3] ?? 1];
    };
    const over = (top: C, base: C): C => [0, 1, 2].map((i) => top[i] * top[3] + base[i] * (1 - top[3])).concat(1) as C;
    const layers: C[] = [];
    for (let n: Element | null = el; n; n = n.parentElement) layers.push(parse(getComputedStyle(n).backgroundColor));
    const bg = layers.reverse().reduce((acc, layer) => over(layer, acc), [255, 255, 255, 1] as C);
    const fg = over(parse(getComputedStyle(el).color), bg);
    const lum = (c: C) =>
      [0, 1, 2]
        .map((i) => c[i] / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
    return { bgLum: lum(bg), ratio: (hi + 0.05) / (lo + 0.05) };
  });
}

const LOGIN = '#navbar button:has-text("Login")';
const REGISTER = '#navbar button:has-text("Register")';

test.describe('home route, bundle loaded', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('page and navbar are dark, auth buttons read at AA, gold focus ring', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => mainCssApplied(page)).toContain('blur');
    expect(await htmlClass(page)).toContain('cbg-route-home');

    expect(await style(page, 'body', 'background-color')).toBe(DARK);
    expect((await paint(page, '#navbar')).bgLum).toBeLessThan(0.02);

    for (const sel of [LOGIN, REGISTER]) {
      await expect(page.locator(sel)).toBeVisible();
      expect((await paint(page, sel)).ratio, sel).toBeGreaterThanOrEqual(4.5);
    }
    expect(await style(page, LOGIN, 'background-color')).toBe('rgba(0, 0, 0, 0)'); // ghost
    expect(await style(page, REGISTER, 'background-color')).toBe('rgb(243, 245, 249)'); // solid --cbg-btn

    // Keyboard focus: the logo link comes first (ring on the round logo), then Login.
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.matches('#navbar .navbar-title-container'))).toBe(true);
    expect(await style(page, '#navbar .navbar-title-container img', 'box-shadow')).toContain('rgb(214, 177, 96)');
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement?.textContent === 'Login')) break;
    }
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('Login');
    // A box-shadow ring: course.link forces `button{outline:none!important}`.
    expect(await style(page, LOGIN, 'box-shadow')).toContain('rgb(214, 177, 96)');
  });
});

test('home route on a phone: Login reads at AA, Register stays hidden as in stock', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect.poll(() => mainCssApplied(page)).toContain('blur');
  await expect(page.locator(LOGIN)).toBeVisible();
  await expect(page.locator(REGISTER)).toBeHidden();
  expect((await paint(page, LOGIN)).ratio).toBeGreaterThanOrEqual(4.5);
});

test('course route does not get the home rules (course restyle comes in T20)', async ({ page }) => {
  await page.goto('/course/preview-101');
  await expect.poll(() => htmlClass(page)).toBe('cbg-js cbg-route-course');
  expect(await style(page, 'body', 'background-color')).not.toBe(DARK);
  expect(await style(page, '#navbar', 'background-color')).toBe('rgb(255, 255, 255)');
  expect(await style(page, LOGIN, 'background-color')).toBe('rgb(255, 255, 255)');
});

// Holding (not aborting) the bundle: an aborted script fires the loader's onerror and fails safe at
// once (e2e/loader.spec.ts covers that). A slow CDN is the case where the critical CSS has to carry
// the first paint, until the 4s fail-safe hands the page back to stock course.link.
test('critical CSS alone keeps home dark until the fail-safe, then the page is stock', async ({ page }) => {
  const held: Route[] = [];
  await page.route(BUNDLE_JS, (r) => void held.push(r));
  await page.route(BUNDLE_CSS, (r) => void held.push(r));
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  expect(await htmlClass(page)).toBe('cbg-js cbg-route-home');
  expect(await mainCssApplied(page)).toBe('none');
  expect(await style(page, 'body', 'background-color')).toBe(DARK);
  expect((await paint(page, '#navbar')).bgLum).toBeLessThan(0.02);
  expect((await paint(page, LOGIN)).ratio).toBeGreaterThanOrEqual(4.5);

  await expect.poll(() => htmlClass(page), { timeout: 6000 }).toBe('cbg-off');
  expect(await style(page, 'body', 'background-color')).not.toBe(DARK);
  expect(await style(page, '#navbar', 'background-color')).toBe('rgb(255, 255, 255)');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('navbar does not move or resize when the main CSS lands', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route(BUNDLE_CSS, async (r) => {
    await gate;
    await r.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const boxes = () =>
    page.evaluate(() =>
      ['#navbar', '#navbar .navbar-title-container img', '#navbar button'].flatMap((s) =>
        [...document.querySelectorAll(s)].map((el) => {
          const r = el.getBoundingClientRect();
          return [s, r.x, r.y, r.width, r.height].join(' ');
        }),
      ),
    );
  await page.locator('#navbar .navbar-title-container img').evaluate((img: HTMLImageElement) => img.decode().catch(() => {}));
  const before = await boxes();
  expect(await mainCssApplied(page)).toBe('none');
  release();
  await expect.poll(() => mainCssApplied(page)).toContain('blur');
  expect(await boxes()).toEqual(before);
});
