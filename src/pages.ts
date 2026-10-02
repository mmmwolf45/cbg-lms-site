// Which kind of page a path is. Every course landing page counts as 'course' (mapped or not, live or
// draft preview), so a new course gets the dark restyle and its block's motion with no code change.
// Shared with the loader's inline script, which marks <html> before the bundle arrives.
export const COURSE_ROUTE = /^\/course\/[^/]+$/;

export type Route = 'home' | 'course' | 'none';

export function routeOf(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '');
  return path === '' ? 'home' : COURSE_ROUTE.test(path) ? 'course' : 'none';
}
