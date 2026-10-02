type Env = { window: Window & typeof globalThis; document: Document };

const QUIET = 100; // wait for React to finish rendering the new page...
const MAX_WAIT = 500; // ...but never longer, even if the DOM never goes quiet (timers, players, toasts)

// Calls onPath at once on every history change (so the route class is never stale), and onChange
// once the DOM has settled after a path change (setup must run after React rendered the new page).
export function watchRoutes(
  onChange: (pathname: string) => void,
  env: Env = { window, document },
  onPath?: (pathname: string) => void,
): () => void {
  const { history, location } = env.window;
  const { pushState, replaceState } = history;
  let last = location.pathname;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstAt = 0;

  const check = () => {
    timer = undefined;
    if (location.pathname === last) return;
    last = location.pathname;
    onChange(last);
  };
  const schedule = () => {
    const now = Date.now();
    if (timer === undefined) firstAt = now;
    clearTimeout(timer);
    timer = setTimeout(check, Math.max(0, Math.min(QUIET, firstAt + MAX_WAIT - now)));
  };
  const navigated = () => {
    onPath?.(location.pathname);
    schedule();
  };

  history.pushState = function (this: History, ...args: Parameters<History['pushState']>) {
    pushState.apply(this, args);
    navigated();
  };
  history.replaceState = function (this: History, ...args: Parameters<History['replaceState']>) {
    replaceState.apply(this, args);
    navigated();
  };
  env.window.addEventListener('popstate', navigated);
  const observer = new env.window.MutationObserver(schedule);
  observer.observe(env.document.getElementById('react-root') ?? env.document.body, { childList: true, subtree: true });

  return () => {
    history.pushState = pushState;
    history.replaceState = replaceState;
    env.window.removeEventListener('popstate', navigated);
    observer.disconnect();
    clearTimeout(timer);
  };
}
