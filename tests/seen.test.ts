import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// seen.ts in node: a fake window, IntersectionObserver and element boxes.
type Box = { top: number; bottom: number; height: number };
type Cb = (list: { target: unknown; isIntersecting: boolean; boundingClientRect: Box }[]) => void;

class FakeIO {
  static all: FakeIO[] = [];
  watched = new Set<unknown>();
  constructor(public cb: Cb, public options: { rootMargin: string }) {
    FakeIO.all.push(this);
  }
  observe(el: unknown) {
    this.watched.add(el);
  }
  unobserve(el: unknown) {
    this.watched.delete(el);
  }
}

const el = (box: Box) => {
  const e = { box, getBoundingClientRect: () => e.box };
  return e as unknown as Element & { box: Box };
};
const at = (top: number, height = 100): Box => ({ top, bottom: top + height, height });

let listeners: Record<string, (() => void)[]>;
let seen: typeof import('../src/motion/seen');

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  FakeIO.all = [];
  listeners = {};
  vi.stubGlobal('IntersectionObserver', FakeIO);
  vi.stubGlobal('window', {
    innerHeight: 800,
    addEventListener: (t: string, f: () => void) => (listeners[t] ??= []).push(f),
    removeEventListener: (t: string, f: () => void) => (listeners[t] = (listeners[t] ?? []).filter((g) => g !== f)),
  });
  seen = await import('../src/motion/seen');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const scroll = () => listeners.scroll?.forEach((f) => f());
const report = (io: FakeIO, target: Element & { box: Box }, isIntersecting: boolean) =>
  io.cb([{ target, isIntersecting, boundingClientRect: target.box }]);

describe('whenSeen', () => {
  it('watches the line at `at` of the screen height', () => {
    seen.whenSeen(el(at(2000)), () => {});
    seen.whenSeen(el(at(2000)), () => {}, 1);
    expect(FakeIO.all.map((io) => io.options.rootMargin)).toEqual(['0px 0px -12% 0px', '0px 0px 0% 0px']);
  });

  it('plays once when the element crosses the line, never again', () => {
    const play = vi.fn();
    const e = el(at(600));
    seen.whenSeen(e, play);
    const io = FakeIO.all[0]!;
    report(io, e, true);
    report(io, e, true);
    expect(play).toHaveBeenCalledTimes(1);
    expect(io.watched.has(e)).toBe(false);
  });

  it('plays an element already above the screen', () => {
    const play = vi.fn();
    const e = el(at(-500));
    seen.whenSeen(e, play);
    report(FakeIO.all[0]!, e, false);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('waits while it is below the line and scrolling continues', () => {
    const play = vi.fn();
    const e = el(at(1200));
    seen.whenSeen(e, play);
    report(FakeIO.all[0]!, e, false);
    vi.advanceTimersByTime(seen.SETTLE + 1);
    expect(play).not.toHaveBeenCalled();
  });

  it('plays anything on screen once the page comes to rest, even below the line', () => {
    const play = vi.fn();
    const e = el(at(1200));
    seen.whenSeen(e, play);
    e.box = at(760); // scrolled: its top is in the bottom 5% of the screen, under the 88% line
    scroll();
    vi.advanceTimersByTime(seen.SETTLE - 20);
    scroll(); // still moving
    vi.advanceTimersByTime(seen.SETTLE - 20);
    expect(play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(40);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('skips elements that are not rendered', () => {
    const play = vi.fn();
    seen.whenSeen(el({ top: 0, bottom: 0, height: 0 }), play);
    vi.advanceTimersByTime(seen.SETTLE + 1);
    expect(play).not.toHaveBeenCalled();
  });

  it('runs every wait on the same element (reveal and the assessment slide share a trigger)', () => {
    const a = vi.fn();
    const b = vi.fn();
    const e = el(at(600));
    seen.whenSeen(e, a);
    seen.whenSeen(e, b);
    report(FakeIO.all[0]!, e, true);
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 1]);
  });

  it('cancel stops it and the last cancel removes the scroll listener', () => {
    const play = vi.fn();
    const e = el(at(600));
    const cancel = seen.whenSeen(e, play);
    expect(listeners.scroll).toHaveLength(1);
    cancel();
    cancel(); // safe twice
    report(FakeIO.all[0]!, e, true);
    vi.advanceTimersByTime(seen.SETTLE + 1);
    expect(play).not.toHaveBeenCalled();
    expect(listeners.scroll).toHaveLength(0);
    expect(FakeIO.all[0]!.watched.has(e)).toBe(false);
  });
});
