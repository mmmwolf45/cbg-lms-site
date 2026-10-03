import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { Section } from '../content/schema';

// Rebar X-ray (PLAN.md E5) on the course mock. The section is rendered from fixture content and put at
// the top of the mock's main block, with the photo pair served from brand/assets/photos, so this runs
// whatever the QS page and the image manifest hold.
const COURSE = '/course/preview-101';
const SCREENS = 'test-results/screens';
mkdirSync(SCREENS, { recursive: true });

const S: Section<'xray'> = {
  heading: 'See the steel. Measure every bar.',
  intro: 'Concrete hides its reinforcement, but a quantity surveyor still has to count and measure every bar in it.',
  image: 'qs-xray-concrete',
  xray: 'qs-xray-steel',
  imageAlt: 'A reinforced concrete column and footing at dusk',
  labels: [
    { text: 'Main bars', at: [667, 354] },
    { text: 'Stirrups', at: [798, 491] },
    { text: 'Lap length', at: [818, 727] },
    { text: 'Development length', at: [666, 817] },
    { text: 'Cutting length', at: [866, 869] },
  ],
  caption: 'Assignment A04: a BBS for a footing and a column from a structural drawing.',
};
const pic = (name: string, alt: string) =>
  `<picture><img src="/xray-fixture/${name}.png" width="1536" height="1024" alt="${alt}"></picture>`;
// Rendered by the real template in a tsx child: Playwright's loader can't import the template's
// images.json without an import attribute.
const args = [S, pic(S.image, S.imageAlt), pic(S.xray, ''), { width: 1536, height: 1024 }];
const SECTION = execFileSync(process.execPath, ['--import', 'tsx', '-e',
  `import('./templates/sections/course-xray.ts').then((m) => process.stdout.write(m.xrayMarkup(...${JSON.stringify(args)})))`,
], { encoding: 'utf8' });

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
  });
  return errors;
}

async function open(page: Page, reducedMotion: 'reduce' | 'no-preference') {
  await page.route('**/xray-fixture/*.png', (r) =>
    r.fulfill({ contentType: 'image/png', body: readFileSync(`brand/assets/photos/${new URL(r.request().url()).pathname.split('/').pop()}`) }));
  await page.route(`**${COURSE}`, async (r) => {
    const res = await r.fetch();
    const body = (await res.text()).replace(/<div data-cbg="[^"]*-main"[^>]*>/, (m) => m + SECTION);
    await r.fulfill({ response: res, body });
  });
  await page.emulateMedia({ reducedMotion });
  await page.goto(COURSE);
  await expect.poll(() => page.evaluate(() => (window as { __cbg?: number }).__cbg)).toBe(1);
  await page.evaluate(() => Promise.all([...document.querySelectorAll<HTMLImageElement>('.cbg-xray img')].map((i) => i.decode().catch(() => {}))));
}

const fig = (page: Page) => page.locator('[data-cbg-xray]');
const hit = (page: Page) => page.locator('.cbg-xray__hit');
const bandX = (page: Page) => fig(page).evaluate((f) => parseFloat(getComputedStyle(f).getPropertyValue('--x')));
const litNames = (page: Page) =>
  page.locator('.cbg-xray__tag').evaluateAll((ts) => ts.filter((t) => getComputedStyle(t).opacity === '1').map((t) => t.textContent));
const rect = (page: Page, sel: string) => page.locator(sel).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});

// The steel photo sits exactly over the concrete one wherever the band is.
async function expectRegistered(page: Page) {
  const a = await rect(page, '.cbg-xray__view > picture img');
  const b = await rect(page, '.cbg-xray__steel img');
  for (const k of ['x', 'y', 'w', 'h'] as const) expect(Math.abs(a[k] - b[k])).toBeLessThan(1);
}

// Every chip shown lies inside the photo.
async function expectChipsInside(page: Page) {
  const f = await rect(page, '.cbg-xray__view');
  const chips = await page.locator('.cbg-xray__tag span').evaluateAll((ss) => ss
    .filter((s) => getComputedStyle(s.parentElement!).opacity !== '0')
    .map((s) => { const r = s.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
  for (const c of chips) {
    expect(c.x).toBeGreaterThanOrEqual(f.x);
    expect(c.x + c.w).toBeLessThanOrEqual(f.x + f.w + 0.5);
    expect(c.y).toBeGreaterThanOrEqual(f.y);
    expect(c.y + c.h).toBeLessThanOrEqual(f.y + f.h + 0.5);
  }
}

test.describe('laptop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('sweeps to the column on view, then the band follows the cursor and lights only the labels inside it', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, 'no-preference');
    await expect(fig(page)).toHaveClass(/is-live/);
    await hit(page).scrollIntoViewIfNeeded();
    await expect.poll(() => bandX(page), { timeout: 4000 }).toBeCloseTo(50, 0);
    await expect.poll(() => litNames(page)).toEqual(S.labels.map((l) => l.text));
    await expectRegistered(page);
    await expectChipsInside(page);
    // The band is about 22% of the photo.
    const v = await rect(page, '.cbg-xray__view');
    const band = await rect(page, '.cbg-xray__band');
    expect(band.w / v.w).toBeCloseTo(0.22, 2);
    await page.waitForTimeout(400);
    await page.locator('#cbg-xray').screenshot({ path: `${SCREENS}/xray-laptop-park.png` });

    await page.mouse.move(v.x + v.w * 0.1, v.y + v.h / 2);
    await expect.poll(() => bandX(page)).toBeCloseTo(10, 0);
    await expect.poll(() => litNames(page)).toEqual([]);
    await page.mouse.move(v.x + v.w * 0.36, v.y + v.h / 2, { steps: 6 });
    await expect.poll(() => bandX(page)).toBeCloseTo(36, 0);
    await expect.poll(() => litNames(page)).toEqual(['Main bars', 'Development length']);
    await expectRegistered(page);
    await page.mouse.move(v.x + v.w * 0.62, v.y + v.h / 2, { steps: 6 });
    await expect.poll(() => litNames(page)).toEqual(['Stirrups', 'Lap length', 'Cutting length']);
    await expectRegistered(page);
    await page.waitForTimeout(400);
    await page.locator('#cbg-xray').screenshot({ path: `${SCREENS}/xray-laptop-cursor.png` });
    expect(errors).toEqual([]);
  });

  test('keyboard: the photo is a named slider, arrow keys move the band, the value names what it shows', async ({ page }) => {
    await open(page, 'no-preference');
    await expect(hit(page)).toBeVisible();
    await expect(hit(page)).toHaveAccessibleName('X-ray scan: move to see the steel');
    await expect(hit(page)).toHaveAccessibleDescription(S.labels.map((l) => l.text).join(' '));
    await hit(page).focus();
    expect(await hit(page).evaluate((h) => getComputedStyle(h).boxShadow)).not.toBe('none');
    await page.keyboard.press('Home');
    await expect(hit(page)).toHaveAttribute('aria-valuenow', '0');
    await expect(hit(page)).toHaveAttribute('aria-valuetext', 'Scan at 0%: no labelled steel');
    await page.keyboard.press('End');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('ArrowLeft');
    await expect(hit(page)).toHaveAttribute('aria-valuenow', '55');
    await expect(hit(page)).toHaveAttribute('aria-valuetext', 'Scan at 55%: Stirrups, Lap length, Cutting length');
    // The labels stay a real list for screen readers; the on-photo copies are hidden from them.
    await expect(page.locator('#cbg-xray-labels li')).toHaveText(S.labels.map((l) => l.text));
    await expect(page.locator('.cbg-xray__tags')).toHaveAttribute('aria-hidden', 'true');
    await page.locator('#cbg-xray').screenshot({ path: `${SCREENS}/xray-laptop-keyboard.png` });
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the scroll sweeps the band left to right, lighting each label on the way', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, 'no-preference');
    await expect(fig(page)).toHaveClass(/is-live/);
    const top = await hit(page).evaluate((h) => h.getBoundingClientRect().top + scrollY);
    const xs: number[] = [];
    const seen = new Set<string>();
    let shot = false;
    for (let y = top - 844; y <= top + 300; y += 60) {
      await page.evaluate((y) => scrollTo(0, y), y);
      await page.waitForTimeout(450); // scrub: 0.4
      xs.push(await bandX(page));
      for (const n of await litNames(page)) seen.add(n!);
      if (!shot && xs.at(-1)! > 45) {
        shot = true;
        await expectRegistered(page);
        await expectChipsInside(page);
        await page.screenshot({ path: `${SCREENS}/xray-phone-scroll.png` });
      }
    }
    expect(xs[0]).toBe(0);
    expect(xs.at(-1)).toBeGreaterThan(99.5);
    expect(xs.every((x, i) => i === 0 || x >= xs[i - 1] - 0.01)).toBe(true);
    expect([...seen].sort()).toEqual(S.labels.map((l) => l.text).sort());
    // Band about 36% of the photo; nothing wider than the screen.
    const v = await rect(page, '.cbg-xray__view');
    expect((await rect(page, '.cbg-xray__band')).w / v.w).toBeCloseTo(0.36, 2);
    expect(await page.evaluate(() => document.querySelector('#cbg-xray')!.scrollWidth)).toBeLessThanOrEqual(390);
    expect(errors).toEqual([]);
  });
});

for (const [name, viewport] of [['laptop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
  test(`reduced motion (${name}): a still split, concrete left and steel right, every label showing`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page, 'reduce');
    await page.locator('#cbg-xray').scrollIntoViewIfNeeded();
    await expect(fig(page)).not.toHaveClass(/is-live/);
    await expect(hit(page)).toBeHidden();
    expect(await litNames(page)).toEqual(S.labels.map((l) => l.text));
    const v = await rect(page, '.cbg-xray__view');
    const band = await rect(page, '.cbg-xray__band');
    expect(Math.abs(band.x - (v.x + v.w / 2))).toBeLessThan(1);
    expect(Math.abs(band.x + band.w - (v.x + v.w))).toBeLessThan(1);
    await expectRegistered(page);
    await expectChipsInside(page);
    await page.locator('#cbg-xray').screenshot({ path: `${SCREENS}/xray-${name}-reduced.png` });
  });
}
