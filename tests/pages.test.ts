import { describe, expect, it } from 'vitest';
import { detectPage, routeClass } from '../src/pages';

const live = { kind: 'course', slug: 'iosh-level-3', uniqueId: '101', preview: false };
const preview = { ...live, preview: true };

describe('detectPage', () => {
  it.each([
    ['/', { kind: 'home' }],
    ['', { kind: 'home' }],
    ['//', { kind: 'home' }],
    ['/course/101-iosh-managing-safely', live],
    ['/course/101-iosh-managing-safely/', live],
    ['/course/101-x', live],
    ['/course/preview-101', preview],
    ['/course/preview-101/', preview],
    ['/course/999-other-course', { kind: 'none' }],
    ['/course/preview-999', { kind: 'none' }],
    ['/course/101', { kind: 'none' }],
    ['/course/101-', { kind: 'none' }],
    ['/course/', { kind: 'none' }],
    ['/course/101-x/lesson/5', { kind: 'none' }],
    ['/course/preview-101/lesson/5', { kind: 'none' }],
    ['/courses', { kind: 'none' }],
    ['/login', { kind: 'none' }],
    ['/course/toString-x', { kind: 'none' }],
    ['/course/constructor-x', { kind: 'none' }],
  ])('%j', (path, page) => {
    expect(detectPage(path)).toEqual(page);
  });
});

describe('routeClass', () => {
  it('names each kind', () => {
    expect(routeClass({ kind: 'home' })).toBe('cbg-route-home');
    expect(routeClass(detectPage('/course/preview-101'))).toBe('cbg-route-course');
    expect(routeClass({ kind: 'none' })).toBe('cbg-route-none');
  });
});
