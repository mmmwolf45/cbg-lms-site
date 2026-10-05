import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { withoutSky } from './no-sky';

withoutSky(); // the sky's software WebGL starves these timing tests (e2e/no-sky.ts)

// The QS build-scrub hero (src/motion/scrub.ts) on a QS mock page, built here in isolation: the bundle into
// its own temp folder (so the shared dist/ and other builds are untouched), and a page from the real
// course.link fixture with a fixture QS top block (the IOSH course with its hero swapped for a build scrub,
// the take-off from content/courses/quantity-surveying.yaml). Frames and images come straight from public/.
// Outside test-results/: a Playwright run elsewhere in the repo empties that folder.
const OUT = join(tmpdir(), 'cbg-scrub-e2e');
const SHOTS = process.env.SCRUB_SHOTS ?? join(tmpdir(), 'cbg-scrub-shots');
const QS = '/course/102-quantity-surveying';
let PAGE = '';

const TYPES: Record<string, string> = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', js: 'text/javascript', css: 'text/css', json: 'application/json' };
const fulfilFile = (file: string) => ({ body: readFileSync(file), contentType: TYPES[file.split('.').pop()!] ?? 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } });

test.beforeAll(() => {
  const root = resolve('.');
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', OUT, '--emptyOutDir', '--logLevel', 'error'], { stdio: 'inherit' });
  const files = readdirSync(OUT);
  const one = (re: RegExp) => files.find((f) => re.test(f))!;
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ js: one(/^cbg\.[^.]+\.js$/), css: one(/^cbg\.[^.]+\.css$/) }));
  const url = (p: string) => JSON.stringify(pathToFileURL(join(root, p)).href);
  const abs = (p: string) => JSON.stringify(join(root, p));
  const gen = join(OUT, 'qs-page.mts');
  writeFileSync(gen, `
import { readFileSync } from 'node:fs';
import { loaderSnippet } from ${url('src/loader/snippet.ts')};
import { loadCourse } from ${url('content/schema.ts')};
import { courseMain, courseTop } from ${url('templates/course.ts')};
const iosh = loadCourse('iosh-level-3.yaml');
const c = { ...iosh, slug: 'quantity-surveying', hero: { ...iosh.hero, visual: 'build-scrub', image: 'hazard-worksite',
  imageAlt: 'A gold line drawing of a building plan that rises into a finished, lit building at dusk', hazards: undefined, tour: undefined,
  scrub: { frames: 'qs-hero', count: 48, label: 'Example take-off', total: 'Ready to price in the BOQ', takeoff: [
    { item: 'Excavation', qty: 180, unit: 'm³', at: 0.2 }, { item: 'Concrete', qty: 95, unit: 'm³', at: 0.38 },
    { item: 'Reinforcement', qty: 9500, unit: 'kg', at: 0.55 }, { item: 'Blockwork', qty: 620, unit: 'm²', at: 0.72 },
    { item: 'Plaster', qty: 1300, unit: 'm²', at: 0.9 } ] } } };
const critical = readFileSync(${abs('src/styles/critical.css')}, 'utf8').replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');
const before = (page, id, html) => { const at = page.lastIndexOf('<', page.indexOf(' id="' + id + '"')); return page.slice(0, at) + html + page.slice(at); };
let p = readFileSync(${abs('preview/fixtures/live-course.html')}, 'utf8')
  .replace(/<script\\b[\\s\\S]*?<\\/script>/g, '').replace(/(href|src)="\\/(?!\\/)/g, '$1="https://cbgtraininginstitute.course.link/');
p = p.replace('</head>', loaderSnippet('/cbg-lms-site/', critical) + '\\n</head>');
p = before(before(p, 'course_content', '<div>' + courseTop(c) + '</div>'), 'reviews', '<div>' + courseMain(c) + '</div>');
process.stdout.write(p);
`);
  PAGE = execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', gen], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  mkdirSync(SHOTS, { recursive: true });
});

// The page, our isolated bundle, and the Pages base (frames, pictures) from public/. `slow` delays the course
// chunk (to see the page before the stage mounts); `block` fails matching Pages requests.
async function serve(page: Page, o: { slow?: number; block?: RegExp } = {}) {
  await page.route(`**${QS}`, (r) => r.fulfill({ body: PAGE, contentType: 'text/html' }));
  await page.route('http://localhost:*/cbg-lms-site/**', async (r) => {
    const file = join(OUT, new URL(r.request().url()).pathname.replace('/cbg-lms-site/', ''));
    if (!existsSync(file)) return r.fulfill({ status: 404, body: '' });
    if (o.slow && /cbg-course\./.test(file)) await new Promise((d) => setTimeout(d, o.slow));
    return r.fulfill(fulfilFile(file));
  });
  await page.route('https://mmmwolf45.github.io/cbg-lms-site/**', (r) => {
    const url = r.request().url();
    const file = join('public', new URL(url).pathname.replace('/cbg-lms-site/', ''));
    if ((o.block && o.block.test(url)) || !existsSync(file)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill(fulfilFile(file));
  });
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function open(page: Page, o?: Parameters<typeof serve>[1]) {
  await serve(page, o);
  await page.goto(QS, { waitUntil: 'load' });
  await expect.poll(() => page.evaluate(() => (window as { __cbg?: number }).__cbg)).toBe(1);
  // ...and the main stylesheet has applied (tokens.css), so later layout changes are ours alone.
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cbg-bg').trim())).not.toBe('');
}

const mounted = (page: Page) => expect.poll(() => page.locator('#course-header-bg > .cbg-scrub-x').count(), { timeout: 8000 }).toBe(1);

const state = (page: Page) =>
  page.evaluate(() => {
    const q = <T extends Element = HTMLElement>(s: string) => document.querySelector<T & HTMLElement>(s);
    const layer = q('.cbg-scrub-x')!;
    const stage = q('.cbg-scrub-x__stage')!;
    const canvas = q<HTMLCanvasElement>('.cbg-scrub-x__canvas')!;
    const rows = [...document.querySelectorAll<HTMLElement>('.cbg-takeoff--live .cbg-takeoff__row')];
    return {
      frame: Number(canvas.dataset.frame ?? -1),
      canvasOpacity: getComputedStyle(canvas).opacity,
      canvasSize: [canvas.width, canvas.height],
      stageTop: Math.round(stage.getBoundingClientRect().top),
      run: layer.offsetHeight - stage.offsetHeight,
      on: rows.filter((r) => r.classList.contains('is-on')).length,
      now: rows.findIndex((r) => r.classList.contains('is-now')),
      qty: rows.map((r) => r.querySelector('[data-cbg-qty]')!.textContent),
      opacity: rows.map((r) => getComputedStyle(r).opacity),
      total: getComputedStyle(q('.cbg-takeoff--live .cbg-takeoff__total')!).opacity,
    };
  });

// Scroll so the stage is fraction f through its run (0: just stuck under the navbar).
async function scrub(page: Page, f: number) {
  await page.evaluate((f) => {
    const layer = document.querySelector<HTMLElement>('.cbg-scrub-x')!, stage = layer.firstElementChild as HTMLElement;
    const top = parseFloat(getComputedStyle(stage).top); // 56 under the navbar; lower on phones (centred)
    scrollTo(0, Math.round(layer.getBoundingClientRect().top + scrollY - top + (layer.offsetHeight - stage.offsetHeight) * f));
  }, f);
}

test.describe('laptop 1280x800, full motion', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the stage mounts in the band under the native header, in the height reserved at first paint', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, { slow: 1500 });
    const geo = () => page.evaluate(() => ({
      band: Math.round(document.getElementById('course-header-bg')!.getBoundingClientRect().height),
      main: Math.round(document.querySelector('#react-root > div:has(#course_content)')!.getBoundingClientRect().top + scrollY),
      header: Math.round(document.getElementById('course-header')!.getBoundingClientRect().height),
    }));
    const before = await geo();
    expect(await page.locator('.cbg-scrub-x').count()).toBe(0); // the chunk is still on its way
    expect(before.band).toBeGreaterThan(before.header + 800); // stage + run reserved under the header
    await mounted(page);
    expect(await geo()).toEqual(before); // nothing below moved when it mounted
    await expect(page.locator('html')).toHaveClass(/\bcbg-scrub-on\b/);
    // The native header is untouched and usable: title, course image, enrol button on top where it was.
    await expect(page.locator('#course-header h2')).toBeVisible();
    await expect(page.locator('#course-header img').first()).toBeVisible();
    const enrol = page.locator('#course-header ul + div button').first();
    const b = (await enrol.boundingBox())!;
    expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('#course-header'), [b.x + b.width / 2, b.y + b.height / 2])).toBe(true);
    // The in-column copy steps aside; the stage carries the poster and the take-off.
    await expect(page.locator('[data-cbg$="-top"] .cbg-scrub')).toBeHidden();
    await expect(page.locator('.cbg-scrub-x__poster img')).toHaveAttribute('sizes', '100vw');
    await expect.poll(async () => (await state(page)).canvasOpacity).toBe('1'); // computed, not just the class
    const s = await state(page);
    expect(s.canvasSize).toEqual([1600, 900]);
    expect(s.frame).toBe(0);
    expect(s.on).toBe(0);
    expect(s.total).toBe('0');
    await page.screenshot({ path: `${SHOTS}/laptop-0-top.png` });
    expect(errors).toEqual([]);
  });

  test('scrolling plays the build while the stage holds, rows count up, the total lands; back reverses', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await mounted(page);
    await scrub(page, 0);
    await expect.poll(async () => (await state(page)).stageTop).toBe(56);
    expect((await state(page)).run).toBeGreaterThan(500); // 80svh of scrolling to play it
    await scrub(page, 0.5);
    await expect.poll(async () => (await state(page)).frame, { timeout: 8000 }).toBeGreaterThan(18);
    await page.waitForTimeout(600);
    const mid = await state(page);
    expect(mid.stageTop).toBe(56);
    expect(mid.frame).toBeLessThan(30);
    expect(mid.on).toBe(2); // Excavation (0.2) and Concrete (0.38) reached, Reinforcement (0.55) not yet
    expect(mid.qty[2]).toBe('0');
    expect(mid.opacity[0]).toBe('1');
    expect(Number(mid.opacity[4])).toBeLessThan(0.5);
    await page.screenshot({ path: `${SHOTS}/laptop-1-mid.png` });
    await scrub(page, 1);
    await expect.poll(async () => (await state(page)).frame, { timeout: 8000 }).toBe(47);
    await expect.poll(async () => (await state(page)).total).toBe('1');
    const end = await state(page);
    expect(end.stageTop).toBe(56);
    expect(end.on).toBe(5);
    expect(end.qty).toEqual(['180', '95', '9,500', '620', '1,300']);
    await page.screenshot({ path: `${SHOTS}/laptop-2-end.png` });
    // The take-off sits right of the building, inside the header's right edge, clear of the enrol card.
    const [panel, card] = await Promise.all([page.locator('.cbg-takeoff--live').boundingBox(), page.locator('div:has(> #course_content) + div').boundingBox()]);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(1280 - 40);
    expect(panel!.x).toBeGreaterThan(640);
    await scrub(page, 1.4); // released: the band ends before the main wrapper and its sticky card
    expect((await page.locator('.cbg-scrub-x').boundingBox())!.y + (await page.locator('.cbg-scrub-x').boundingBox())!.height).toBeLessThanOrEqual((await page.locator('div:has(> #course_content) + div').boundingBox())!.y);
    expect(card).not.toBeNull();
    await scrub(page, 0);
    await expect.poll(async () => (await state(page)).frame, { timeout: 8000 }).toBe(0);
    await expect.poll(async () => (await state(page)).total).toBe('0');
    expect((await state(page)).on).toBe(0);
    expect(errors).toEqual([]);
  });

  test('frames that fail to load leave the poster; the take-off still counts', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, { block: /qs-hero\// });
    await mounted(page);
    await scrub(page, 1);
    await expect.poll(async () => (await state(page)).on, { timeout: 8000 }).toBe(5);
    const s = await state(page);
    expect(s.canvasOpacity).toBe('0');
    expect(s.frame).toBe(-1);
    await expect(page.locator('.cbg-scrub-x__poster img')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('leaving the page tears it down exactly; coming back mounts it again', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await mounted(page);
    const original = await page.evaluate(async () => {
      const doc = new DOMParser().parseFromString(await (await fetch(location.href)).text(), 'text/html');
      return doc.getElementById('course-header-bg')!.outerHTML;
    });
    await page.evaluate(() => history.pushState({}, '', '/'));
    await expect.poll(() => page.locator('.cbg-scrub-x').count()).toBe(0);
    await expect(page.locator('html')).not.toHaveClass(/\bcbg-scrub-on\b/);
    const after = await page.evaluate(() => document.getElementById('course-header-bg')!.outerHTML);
    const norm = (s: string) => s.replace(/\s+/g, ' ').replace(/&amp;/g, '&');
    expect(norm(after)).toBe(norm(original)); // the band exactly as course.link rendered it
    await page.evaluate((p) => history.pushState({}, '', p), QS);
    await mounted(page);
    expect(errors).toEqual([]);
  });

  test('waits for React to hydrate the band before inserting into it', async ({ page }) => {
    await serve(page);
    // A server-rendered page (Vike's page context present) whose band React has not claimed yet.
    await page.route(`**${QS}`, (r) => r.fulfill({ body: PAGE.replace('</body>', '<div id="vike_pageContext" hidden></div></body>'), contentType: 'text/html' }));
    await page.goto(QS, { waitUntil: 'load' });
    await expect.poll(() => page.evaluate(() => (window as { __cbg?: number }).__cbg)).toBe(1);
    await page.waitForTimeout(1200);
    expect(await page.locator('.cbg-scrub-x').count()).toBe(0);
    await page.evaluate(() => Object.assign(document.getElementById('course-header-bg')!, { __reactFiber$test: {} }));
    await mounted(page);
  });
});

test.describe('phone 390x844, full motion', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

  test('square footage under the header, a one-row take-off strip, square frames', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await mounted(page);
    await expect.poll(async () => (await state(page)).canvasOpacity).toBe('1');
    expect((await state(page)).canvasSize).toEqual([900, 900]);
    const film = (await page.locator('.cbg-scrub-x__film').boundingBox())!;
    expect(film.width).toBe(390);
    expect(Math.abs(film.height - 390)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${SHOTS}/phone-0-top.png` });
    await scrub(page, 0.6);
    await page.waitForTimeout(800);
    const mid = await state(page);
    const stageH = (await page.locator('.cbg-scrub-x__stage').boundingBox())!.height;
    expect(Math.abs(mid.stageTop - (56 + (844 - 56 - stageH) / 2))).toBeLessThanOrEqual(1); // held mid-screen under the navbar
    expect(mid.now).toBe(2); // Reinforcement, the last row reached
    expect(mid.opacity.filter((o) => Number(o) > 0)).toHaveLength(1); // one row in the strip
    await page.screenshot({ path: `${SHOTS}/phone-1-mid.png` });
    await scrub(page, 1);
    await expect.poll(async () => (await state(page)).total, { timeout: 8000 }).toBe('1');
    const end = await state(page);
    expect(end.now).toBe(4);
    expect(end.qty[4]).toBe('1,300');
    await page.screenshot({ path: `${SHOTS}/phone-2-end.png` });
    expect(errors).toEqual([]);
  });
});

test('reduced motion: no takeover; the poster and the whole take-off in the column, still', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.waitForTimeout(1000);
  expect(await page.locator('.cbg-scrub-x').count()).toBe(0);
  await expect(page.locator('html')).not.toHaveClass(/\bcbg-scrub-on\b/);
  const band = await page.evaluate(() => ({
    band: document.getElementById('course-header-bg')!.getBoundingClientRect().height,
    header: document.getElementById('course-header')!.getBoundingClientRect().height,
    after: getComputedStyle(document.getElementById('course-header-bg')!, '::after').content,
  }));
  expect(band.band).toBe(band.header); // nothing reserved
  const visual = page.locator('[data-cbg$="-top"] .cbg-scrub');
  await expect(visual).toBeVisible();
  await expect(visual.locator('.cbg-scrub__poster img')).toBeVisible();
  await expect(visual.locator('.cbg-takeoff__row')).toHaveCount(5);
  await expect(visual.locator('[data-cbg-qty]')).toHaveText(['180', '95', '9,500', '620', '1,300']);
  await expect(visual.locator('.cbg-takeoff__total')).toBeVisible();
  for (const o of await visual.locator('.cbg-takeoff__row, .cbg-takeoff__total').evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity))) expect(o).toBe('1');
  await visual.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/reduced.png` });
  expect(errors).toEqual([]);
});
