import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchRoutes } from '../src/router';
import { pageSwitcher, type Setups } from '../src/main';

class FakeObserver {
  static last: FakeObserver;
  target: unknown;
  options: unknown;
  connected = false;
  constructor(private cb: () => void) {
    FakeObserver.last = this;
  }
  observe(target: unknown, options: unknown) {
    this.target = target;
    this.options = options;
    this.connected = true;
  }
  disconnect() {
    this.connected = false;
  }
  trigger() {
    if (this.connected) this.cb();
  }
}

function makeEnv(reactRoot: object | null = {}) {
  const location = { pathname: '/' };
  const go = (_s: unknown, _t: string, url?: string | URL | null) => {
    if (url) location.pathname = String(url);
  };
  const pushState = vi.fn(go);
  const replaceState = vi.fn(go);
  const history = { pushState, replaceState };
  const win = Object.assign(new EventTarget(), { location, history, MutationObserver: FakeObserver });
  const body = {};
  const document = { body, getElementById: (id: string) => (id === 'react-root' ? reactRoot : null) };
  const env = { window: win, document } as unknown as Parameters<typeof watchRoutes>[1];
  return { env, win, location, history, pushState, replaceState, body };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('watchRoutes', () => {
  it('fires once after pushState to a new path, calling the original', () => {
    const t = makeEnv();
    const onChange = vi.fn();
    watchRoutes(onChange, t.env);
    t.history.pushState({ a: 1 }, '', '/course/preview-101');
    expect(t.pushState).toHaveBeenCalledWith({ a: 1 }, '', '/course/preview-101');
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('/course/preview-101');
  });

  it('fires once after replaceState to a new path', () => {
    const t = makeEnv();
    const onChange = vi.fn();
    watchRoutes(onChange, t.env);
    t.history.replaceState(null, '', '/login');
    vi.advanceTimersByTime(100);
    expect(t.replaceState).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('/login');
  });

  it('fires once on popstate to a new path', () => {
    const t = makeEnv();
    const onChange = vi.fn();
    watchRoutes(onChange, t.env);
    t.location.pathname = '/course/101-x';
    t.win.dispatchEvent(new Event('popstate'));
    vi.advanceTimersByTime(100);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('/course/101-x');
  });

  it('fires once on a DOM mutation after the path changed', () => {
    const t = makeEnv();
    const onChange = vi.fn();
    watchRoutes(onChange, t.env);
    t.location.pathname = '/course/101-x';
    FakeObserver.last.trigger();
    vi.advanceTimersByTime(100);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('/course/101-x');
  });

  it('observes #react-root, or body when it is missing', () => {
    const root = {};
    watchRoutes(() => {}, makeEnv(root).env);
    expect(FakeObserver.last.target).toBe(root);
    expect(FakeObserver.last.options).toEqual({ childList: true, subtree: true });
    const t = makeEnv(null);
    watchRoutes(() => {}, t.env);
    expect(FakeObserver.last.target).toBe(t.body);
  });

  it('does not fire when the path is unchanged', () => {
    const t = makeEnv();
    const onChange = vi.fn();
    watchRoutes(onChange, t.env);
    t.history.pushState(null, '', '/');
    t.history.replaceState(null, '', '/');
    t.win.dispatchEvent(new Event('popstate'));
    FakeObserver.last.trigger();
    vi.advanceTimersByTime(1000);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('debounces a burst into one call', () => {
    const t = makeEnv();
    const onChange = vi.fn();
    watchRoutes(onChange, t.env);
    t.history.pushState(null, '', '/course/101-x');
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(60);
      FakeObserver.last.trigger();
    }
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('compares each change with the path of the last call', () => {
    const t = makeEnv();
    const onChange = vi.fn();
    watchRoutes(onChange, t.env);
    t.history.pushState(null, '', '/a');
    vi.advanceTimersByTime(100);
    t.history.pushState(null, '', '/a');
    vi.advanceTimersByTime(100);
    t.history.pushState(null, '', '/b');
    vi.advanceTimersByTime(100);
    expect(onChange.mock.calls).toEqual([['/a'], ['/b']]);
  });

  it('stop() restores the originals and disconnects everything', () => {
    const t = makeEnv();
    const onChange = vi.fn();
    const stop = watchRoutes(onChange, t.env);
    expect(t.history.pushState).not.toBe(t.pushState);
    t.history.pushState(null, '', '/pending');
    stop();
    expect(t.history.pushState).toBe(t.pushState);
    expect(t.history.replaceState).toBe(t.replaceState);
    expect(FakeObserver.last.connected).toBe(false);
    t.location.pathname = '/other';
    t.win.dispatchEvent(new Event('popstate'));
    vi.advanceTimersByTime(1000);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('pageSwitcher', () => {
  function fakeRoot() {
    const set = new Set<string>();
    const classList = {
      add: (...c: string[]) => c.forEach((x) => set.add(x)),
      remove: (...c: string[]) => c.forEach((x) => set.delete(x)),
    };
    return { set, root: { classList } as unknown as HTMLElement };
  }

  it('tears down the old page before setting up the new one, and sets the route class', () => {
    const log: string[] = [];
    const make = (kind: string) => () => {
      log.push(`setup ${kind}`);
      return () => void log.push(`teardown ${kind}`);
    };
    const setups: Setups = { home: make('home'), course: make('course'), none: make('none') };
    const { set, root } = fakeRoot();
    const go = pageSwitcher(setups, root);
    go('/');
    expect([...set].sort()).toEqual(['cbg-js', 'cbg-route-home']);
    set.delete('cbg-js');
    go('/course/preview-101');
    expect([...set].sort()).toEqual(['cbg-js', 'cbg-route-course']);
    go('/login');
    expect(log).toEqual(['setup home', 'teardown home', 'setup course', 'teardown course', 'setup none']);
  });

  it('keeps going and warns when a teardown or setup throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const course = vi.fn(() => () => {});
    const setups: Setups = {
      home: () => () => {
        throw new Error('teardown');
      },
      course,
      none: () => {
        throw new Error('setup');
      },
    };
    const go = pageSwitcher(setups, fakeRoot().root);
    go('/');
    expect(() => go('/course/101-x')).not.toThrow();
    expect(course).toHaveBeenCalledTimes(1);
    expect(() => go('/login')).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toBe('[cbg]');
    warn.mockRestore();
  });
});
