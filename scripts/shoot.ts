// Full-page screenshots for review: npx tsx scripts/shoot.ts <path> <name> [widths...]
// Needs the mock server (npm run serve). Saves to test-results/screens/<name>-<width>.png
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [path = '/', name = 'page', ...ws] = process.argv.slice(2);
const widths = ws.length ? ws.map(Number) : [1440, 390];
mkdirSync('test-results/screens', { recursive: true });

const browser = await chromium.launch();
for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: width < 768 ? 2 : 1 });
  await page.goto(`http://localhost:4173${path}`, { waitUntil: 'networkidle' });
  // Scroll through like a reader so scroll-triggered reveals run, then return to the top.
  for (let y = 0; y < (await page.evaluate(() => document.body.scrollHeight)); y += 400) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500); // let entrance animations finish
  const file = `test-results/screens/${name}-${width}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(file);
  await page.close();
}
await browser.close();
