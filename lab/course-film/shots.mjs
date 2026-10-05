// Screenshots at 1440x900 and 390x844, three scroll positions. Serve out/ first:
//   npx tsx lab/serve.ts lab/course-film/out <port>   then   node lab/course-film/shots.mjs <port>
import { chromium } from 'playwright';
const port = process.argv[2];
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  for (const [name, frac] of [['0', 0], ['50', 0.5], ['100', 1]]) {
    const y = await p.evaluate((f) => { const s = document.querySelector('.story'); return s.offsetTop + f * (s.offsetHeight - innerHeight); }, frac);
    await p.evaluate((y) => scrollTo(0, y), y);
    await p.waitForTimeout(300);
    const fr = await p.evaluate(() => window.__filmSettle?.());
    await p.waitForTimeout(150);
    await p.screenshot({ path: `lab/shots/film-iosh-${w}-${name}.png` });
    console.log(w, name, 'frame', fr);
  }
  if (errs.length) console.log('errors', errs);
  await p.close();
}
await b.close();
