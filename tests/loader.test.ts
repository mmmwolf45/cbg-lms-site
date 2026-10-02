import { describe, expect, it, vi } from 'vitest';
import { bootScript, loaderSnippet, TIMEOUT_MS } from '../src/loader/snippet';
import { routeOf } from '../src/pages';

// Runs the inline boot script against a fake document, the way it runs in course.link's <head>.
function boot(pathname: string, fetchImpl: () => Promise<unknown>) {
  const classes = new Set<string>();
  const appended: { tag: string; [k: string]: unknown }[] = [];
  const doc = {
    documentElement: {
      classList: { add: (...c: string[]) => c.forEach((x) => classes.add(x)), remove: (...c: string[]) => c.forEach((x) => classes.delete(x)) },
    },
    head: { appendChild: (el: { tag: string }) => appended.push(el) },
    createElement: (tag: string) => ({ tag }),
  };
  const win: { __cbg?: number } = {};
  new Function('document', 'window', 'location', 'fetch', 'setTimeout', bootScript('https://cdn.test/'))(
    doc, win, { pathname }, fetchImpl, setTimeout,
  );
  return { classes, appended, win };
}

const ok = () =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ js: 'cbg.a.js', css: 'cbg.b.css' }) });

describe('loader boot script', () => {
  it.each(['/', '/course/101-iosh-level3-certificate', '/course/preview-101', '/course/999-new', '/course/101-x/lesson/3', '/login'])(
    'marks %s with the same route as the bundle',
    (path) => {
      const { classes } = boot(path, ok);
      expect(classes).toContain('cbg-js');
      expect(classes).toContain(`cbg-route-${routeOf(path)}`);
    },
  );

  it('adds the font stylesheet from script, then the hashed CSS and JS from the manifest', async () => {
    const { appended } = boot('/', ok);
    await vi.waitFor(() => expect(appended).toHaveLength(3));
    expect(appended[0]).toMatchObject({ tag: 'link', rel: 'stylesheet', href: expect.stringContaining('Source+Sans+3') });
    expect(appended[1]).toMatchObject({ tag: 'link', rel: 'stylesheet', href: 'https://cdn.test/cbg.b.css' });
    expect(appended[2]).toMatchObject({ tag: 'script', type: 'module', src: 'https://cdn.test/cbg.a.js' });
  });

  it('adds no font stylesheet on pages that are not ours (lessons, dashboard)', async () => {
    const { appended } = boot('/course/101-x/lesson/2', ok);
    await vi.waitFor(() => expect(appended).toHaveLength(2));
    expect(appended.some((e) => String(e.href).includes('fonts.googleapis'))).toBe(false);
  });

  it('fails safe when the manifest cannot be fetched', async () => {
    const { classes } = boot('/', () => Promise.reject(new Error('offline')));
    await vi.waitFor(() => expect(classes).toContain('cbg-off'));
    expect([...classes]).toEqual(['cbg-off']);
  });

  it('fails safe when the bundle has not started before the timeout', () => {
    vi.useFakeTimers();
    const { classes } = boot('/', () => new Promise(() => {}));
    vi.advanceTimersByTime(TIMEOUT_MS);
    expect(classes).toContain('cbg-off');
    vi.useRealTimers();
  });

  it('leaves a started bundle alone at the timeout', () => {
    vi.useFakeTimers();
    const { classes, win } = boot('/', () => new Promise(() => {}));
    win.__cbg = 1;
    vi.advanceTimersByTime(TIMEOUT_MS);
    expect(classes).toContain('cbg-js');
    expect(classes).not.toContain('cbg-off');
    vi.useRealTimers();
  });
});

describe('loader snippet', () => {
  it('stays small and carries noindex and the font link', () => {
    const html = loaderSnippet('https://mmmwolf45.github.io/cbg-lms-site/', '');
    expect(html).toContain('<meta name="robots" content="noindex,nofollow">');
    expect(html).toContain('Source+Sans+3');
    expect(Buffer.byteLength(html)).toBeLessThan(2048);
  });
});
