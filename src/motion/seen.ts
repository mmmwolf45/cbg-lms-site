// Runs an element's one-off entrance when the reader gets to it. Three ways in, whichever comes first:
// - scrolling: its top passes `at` of the screen height (0.88 = 'top 88%');
// - coming to rest: the page has been still for SETTLE ms with any of it on screen, so nothing visible
//   ever waits for one more scroll (the line at 88% would otherwise leave the bottom of a phone screen
//   empty, and at the end of the page a short element might never reach it);
// - already passed: it is above the screen (a reload mid-page, a jump to an anchor).
// IntersectionObserver works from the live layout, so a late change above (fonts, images, course.link's
// own sections) can't leave it waiting on a stale scroll position, which ScrollTrigger start values can.
type Entry = { el: Element; at: number; play: () => void };

export const SETTLE = 120;

const entries = new Set<Entry>();
const observers = new Map<number, IntersectionObserver>();
let timer: ReturnType<typeof setTimeout> | undefined;

const same = (a: Entry, b: Entry) => a.el === b.el && a.at === b.at;

function fire(x: Entry) {
  if (!entries.delete(x)) return;
  if (![...entries].some((y) => same(x, y))) observers.get(x.at)?.unobserve(x.el);
  x.play();
}

function observer(at: number) {
  let io = observers.get(at);
  if (!io) {
    io = new IntersectionObserver(
      (list) => {
        for (const e of list) {
          if (!e.isIntersecting && e.boundingClientRect.bottom > 0) continue;
          for (const x of [...entries]) if (x.el === e.target && x.at === at) fire(x);
        }
      },
      { rootMargin: `0px 0px ${-Math.round((1 - at) * 100)}% 0px` },
    );
    observers.set(at, io);
  }
  return io;
}

// Anything on screen once the page is still. Unrendered elements (display: none) have an empty box.
function sweep() {
  const vh = window.innerHeight;
  for (const x of [...entries]) {
    const r = x.el.getBoundingClientRect();
    if (r.height > 0 && r.top < vh && r.bottom > 0) fire(x);
  }
}

function onScroll() {
  clearTimeout(timer);
  timer = setTimeout(sweep, SETTLE);
}

// Calls play once, when el is seen. Returns a cancel for teardown (safe to call after it has played).
export function whenSeen(el: Element, play: () => void, at = 0.88): () => void {
  const x: Entry = { el, at, play };
  if (!entries.size) window.addEventListener('scroll', onScroll, { passive: true });
  entries.add(x);
  observer(at).observe(el);
  onScroll(); // a page that is already still
  return () => {
    if (!entries.delete(x)) return;
    if (![...entries].some((y) => same(x, y))) observers.get(at)?.unobserve(el);
    if (!entries.size) {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    }
  };
}
