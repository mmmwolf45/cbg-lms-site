import { describe, expect, it } from 'vitest';
import { HASHED, KEEP, buildFiles, nextHistory } from '../scripts/keep-previous';

describe('keep-previous (old build files stay on Pages for stale manifests)', () => {
  it('lists a build: entry, stylesheet and the page chunks the entry imports', () => {
    const entry = 'import("./cbg-home.CQaJlD88.js");import("./cbg-course.DJlAwz8X.js");import("./cbg-home.CQaJlD88.js")';
    expect(buildFiles({ js: 'cbg.CDAOHUjz.js', css: 'cbg.CPPHZvm4.css' }, entry)).toEqual([
      'cbg-course.DJlAwz8X.js',
      'cbg-home.CQaJlD88.js',
      'cbg.CDAOHUjz.js',
      'cbg.CPPHZvm4.css',
    ]);
  });

  it('keeps this build plus the last KEEP, newest first, without repeating a rebuild', () => {
    const b = (n: number) => [`cbg.${n}.js`];
    expect(nextHistory(b(4), [b(3), b(2), b(1)])).toEqual([b(4), b(3), b(2)].slice(0, KEEP + 1));
    expect(nextHistory(b(3), [b(3), b(2)])).toEqual([b(3), b(2)]);
    expect(nextHistory(b(1), [])).toEqual([b(1)]);
  });

  it('only ever copies our hashed bundle files', () => {
    expect(HASHED.test('cbg.CDAOHUjz.js')).toBe(true);
    expect(HASHED.test('cbg-course.DJlAwz8X.js')).toBe(true);
    expect(HASHED.test('cbg.CPPHZvm4.css')).toBe(true);
    expect(HASHED.test('manifest.json')).toBe(false);
    expect(HASHED.test('../secrets.js')).toBe(false);
    expect(HASHED.test('loader-snippet.html')).toBe(false);
  });
});
