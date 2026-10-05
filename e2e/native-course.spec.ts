import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { withoutSky } from './no-sky';

withoutSky(); // the sky's software WebGL starves these timing tests (e2e/no-sky.ts)

// T20: course.link's own course page (header band, main wrapper, enrol card, Course Content
// accordion) goes dark on the course route only. The live behaviour checks (accordion opens and
// closes, sticky card, phone bottom bar) are in probe-native-course.spec.ts.
const DARK = 'rgb(8, 18, 38)'; // --cbg-bg
const BUNDLE_JS = '**/cbg-lms-site/cbg.*.js';
const BUNDLE_CSS = '**/cbg-lms-site/cbg.*.css';
const COURSE = '/course/preview-101';
const SCREENS = 'test-results/screens';

// The page is dark: navy canvas colour on <html>, see-through body, the still gradient on body::before.
const pageDark = (page: Page) =>
  page.evaluate(
    ([dark]) =>
      getComputedStyle(document.documentElement).backgroundColor === dark &&
      getComputedStyle(document.body).backgroundColor === 'rgba(0, 0, 0, 0)' &&
      getComputedStyle(document.body, '::before').backgroundImage.includes('radial-gradient'),
    [DARK],
  );

const HEADER = '#course-header-bg';
const WRAPPER = '#react-root > div:has(#course_content)';
const CARD = 'div:has(> #course_content) + div';
const TEXT = {
  title: '#course-header h2',
  subtitle: '#course-header h2 + p',
  stat: '#course-header ul > li',
  cardTitle: `${CARD} h5`,
  cardLabel: `${CARD} p`,
  cardItem: `${CARD} li`,
  cardButton: `${CARD} button`,
  heading: '#course_content > div:first-child > h4',
  expandAll: '#course_content > div:first-child > button',
  sectionTitle: '#course_content h3 > button h6',
  sectionCount: '#course_content h3 > button p',
  lesson: '#course_content [role="region"] [role="button"] p',
};

const htmlClass = (page: Page) => page.evaluate(() => document.documentElement.className);
const style = (page: Page, sel: string, prop: string) =>
  page.locator(sel).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
// Only the main CSS sets backdrop-filter on the navbar, so this tells us it has been applied.
const mainCssApplied = (page: Page) => style(page, '#navbar', 'backdrop-filter');

// Effective colours as painted: the element's text colour over its background, each composited
// over the backgrounds of its ancestors (down to the white canvas), then the WCAG contrast ratio.
// Solid `linear-gradient(C, C)` layers count as background colour: the header band is painted
// that way over course.link's inline theme colour, and the enrol card's glass is one too.
function paint(page: Page, sel: string, nth = 0) {
  return page.locator(sel).nth(nth).evaluate((el) => {
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
      return [parse(cs.backgroundColor), ...solid.reverse()]; // bottom to top
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
}

// Background luminance behind a box (its own layers plus its ancestors'), for "is it dark".
const bgLum = async (page: Page, sel: string) => (await paint(page, sel)).bgLum;

async function expectAllReadable(page: Page, sel: string) {
  const n = await page.locator(sel).count();
  expect(n, sel).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    if (!(await page.locator(sel).nth(i).isVisible())) continue;
    expect((await paint(page, sel, i)).ratio, `${sel} #${i}`).toBeGreaterThanOrEqual(4.5);
  }
}

test.describe('course route at 1440, bundle loaded', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('page, header band, wrapper and enrol card are dark; text reads at AA; card still sticky', async ({ page }) => {
    await page.goto(COURSE);
    await expect.poll(() => mainCssApplied(page)).toContain('blur');
    expect(await htmlClass(page)).toContain('cbg-route-course');

    expect(await pageDark(page)).toBe(true);
    for (const sel of [HEADER, WRAPPER, CARD, '#navbar']) expect(await bgLum(page, sel), sel).toBeLessThan(0.02);
    expect(await style(page, CARD, 'position')).toBe('sticky');
    expect(await style(page, CARD, 'top')).toBe('72px');

    for (const sel of Object.values(TEXT)) await expectAllReadable(page, sel);

    // Gold accents: chevrons and the card's check icons (recoloured, not replaced).
    expect(await style(page, '#course_content h3 > button > svg', 'color')).toBe('rgb(214, 177, 96)');
    expect(await style(page, `${CARD} li svg`, 'color')).toBe('rgb(214, 177, 96)');
    expect(await style(page, `${CARD} button`, 'background-color')).toBe('rgb(243, 245, 249)');

    mkdirSync(SCREENS, { recursive: true });
    await page.screenshot({ path: `${SCREENS}/native-course-mock-1440.png` });
    await page.locator('#course_content').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SCREENS}/native-course-mock-1440-content.png` });
  });

  test('the enrol card does not move or resize when the main CSS lands', async ({ page }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    await page.route(BUNDLE_CSS, async (r) => {
      await gate;
      await r.continue();
    });
    await page.goto(COURSE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    const boxes = () =>
      page.evaluate(
        (sels) =>
          sels.map((s) => {
            const r = document.querySelector(s)?.getBoundingClientRect();
            return r ? [s, r.x, r.y, r.width, r.height].join(' ') : `${s} missing`;
          }),
        [CARD, '#course-header-bg', '#course-header h2', '#course-header ul'],
      );
    const before = await boxes();
    expect(await mainCssApplied(page)).toBe('none');
    release();
    await expect.poll(() => mainCssApplied(page)).toContain('blur');
    await page.evaluate(() => document.fonts.ready);
    expect(await boxes()).toEqual(before);
  });
});

test('course route on a phone: dark, readable, highlights list included', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(COURSE);
  await expect.poll(() => mainCssApplied(page)).toContain('blur');
  expect(await pageDark(page)).toBe(true);
  for (const sel of [HEADER, WRAPPER]) expect(await bgLum(page, sel), sel).toBeLessThan(0.02);
  for (const sel of [TEXT.title, TEXT.subtitle, TEXT.stat, '#highlights h4', '#highlights li', TEXT.sectionTitle, TEXT.lesson]) {
    await expectAllReadable(page, sel);
  }
  mkdirSync(SCREENS, { recursive: true });
  await page.screenshot({ path: `${SCREENS}/native-course-mock-390.png` });
});

// Holding (not aborting) the bundle, as in native-home.spec.ts: the critical CSS alone has to carry
// the first paint with no dark-on-dark text, until the 4s fail-safe hands the page back to stock.
test('critical CSS alone keeps the course page dark and readable until the fail-safe', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const held: Route[] = [];
  await page.route(BUNDLE_JS, (r) => void held.push(r));
  await page.route(BUNDLE_CSS, (r) => void held.push(r));
  await page.goto(COURSE, { waitUntil: 'domcontentloaded' });

  expect(await htmlClass(page)).toBe('cbg-js cbg-route-course');
  expect(await mainCssApplied(page)).toBe('none');
  expect(await pageDark(page)).toBe(true);
  for (const sel of [HEADER, WRAPPER, CARD]) expect(await bgLum(page, sel), sel).toBeLessThan(0.02);
  for (const sel of [TEXT.title, TEXT.cardTitle, TEXT.heading, TEXT.sectionTitle, TEXT.sectionCount, TEXT.lesson]) {
    expect((await paint(page, sel)).ratio, sel).toBeGreaterThanOrEqual(4.5);
  }

  await expect.poll(() => htmlClass(page), { timeout: 6000 }).toBe('cbg-off');
  expect(await style(page, 'body', 'background-color')).toBe('rgb(255, 255, 255)');
  expect(await style(page, WRAPPER, 'background-color')).toBe('rgb(255, 255, 255)');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('home route is not touched by the course-only rules', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => mainCssApplied(page)).toContain('blur');
  // Plant the course hooks on the home page: none of the course rules may match there.
  await page.evaluate(() => {
    const root = document.querySelector('#react-root')!;
    root.insertAdjacentHTML(
      'beforeend',
      '<div id="course-header-bg"><div id="course-header"><h2>t</h2><ul><li>s</li></ul></div></div>' +
        '<div id="t20-wrap"><div><div><div id="course_content"><div><h4>Course Content</h4></div></div></div><div id="t20-card">c</div></div></div>',
    );
  });
  expect(await style(page, '#course-header-bg', 'background-image')).toBe('none');
  expect(await style(page, '#course-header h2', 'font-weight')).not.toBe('800');
  expect(await style(page, '#course-header li', 'padding-left')).toBe('0px');
  expect(await style(page, '#t20-wrap', 'background-color')).toBe('rgba(0, 0, 0, 0)');
  expect(await style(page, '#t20-card', 'background-color')).toBe('rgba(0, 0, 0, 0)');
  expect(await style(page, '#course_content h4', 'font-weight')).not.toBe('800');
  // And the shared chrome on home is as before.
  expect(await pageDark(page)).toBe(true);
});
