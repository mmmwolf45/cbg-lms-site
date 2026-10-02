export const courseMap: Record<string, string> = { '101': 'iosh-level-3' };

export type Page =
  | { kind: 'home' }
  | { kind: 'course'; slug: string; uniqueId: string; preview: boolean }
  | { kind: 'none' };

export function detectPage(pathname: string): Page {
  const path = pathname.replace(/\/+$/, '');
  if (path === '') return { kind: 'home' };
  const m = path.match(/^\/course\/(?:preview-([^/]+)|([^/-]+)-[^/]+)$/);
  const uniqueId = m?.[1] ?? m?.[2];
  const slug = uniqueId && Object.hasOwn(courseMap, uniqueId) ? courseMap[uniqueId] : undefined;
  if (!uniqueId || !slug) return { kind: 'none' };
  return { kind: 'course', slug, uniqueId, preview: m?.[1] !== undefined };
}

export function routeClass(page: Page): string {
  return `cbg-route-${page.kind}`;
}

// Route styling (dark native restyle) covers every course landing page, mapped or not,
// so a new course looks right before its block exists. Shared with the loader's inline script.
export const COURSE_ROUTE = /^\/course\/[^/]+$/;

export function routeOf(pathname: string): Page['kind'] {
  const path = pathname.replace(/\/+$/, '');
  return path === '' ? 'home' : COURSE_ROUTE.test(path) ? 'course' : 'none';
}
