import { describe, expect, it } from 'vitest';
import { routeOf } from '../src/pages';

describe('routeOf', () => {
  it.each([
    ['/', 'home'],
    ['', 'home'],
    ['//', 'home'],
    ['/course/101-iosh-level3-certificate', 'course'],
    ['/course/101-iosh-level3-certificate/', 'course'],
    ['/course/preview-101', 'course'],
    ['/course/202-a-new-course', 'course'],
    ['/course/', 'none'],
    ['/course/101-x/lesson/5', 'none'],
    ['/course/preview-101/lesson/5', 'none'],
    ['/courses', 'none'],
    ['/login', 'none'],
  ])('%j is %s', (path, route) => {
    expect(routeOf(path)).toBe(route);
  });
});
