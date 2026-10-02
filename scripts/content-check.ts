import { hasPage, loadCourseFiles, loadHome } from '../content/schema';
import images from '../src/images.json';

try {
  const home = loadHome();
  const courses = loadCourseFiles();
  const name = (c: (typeof courses)[number]) => (hasPage(c) ? c.slug : `${c.slug} (card only)`);
  console.log(`content OK: home.yaml (${Object.keys(home).length} sections), ${courses.length} course(s): ${courses.map(name).join(', ')}`);
  // Not an error: a card shows a navy placeholder until its photo is added and `npm run images` is run.
  const waiting = courses.map((c) => c.card.image).filter((i) => i && !(i in images));
  if (waiting.length) console.log(`  card photos not built yet (placeholder shown): ${waiting.join(', ')}`);
} catch (e) {
  console.error(`content check failed: ${(e as Error).message}`);
  process.exit(1);
}
