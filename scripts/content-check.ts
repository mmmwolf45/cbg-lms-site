import { loadCourses, loadHome } from '../content/schema';

try {
  const home = loadHome();
  const courses = loadCourses();
  console.log(`content OK: home.yaml (${Object.keys(home).length} sections), ${courses.length} course(s): ${courses.map((c) => c.slug).join(', ')}`);
} catch (e) {
  console.error(`content check failed: ${(e as Error).message}`);
  process.exit(1);
}
