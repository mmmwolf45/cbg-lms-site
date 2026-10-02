type Env = { window: Window & typeof globalThis; document: Document };

export function watchRoutes(onChange: (pathname: string) => void, env: Env = { window, document }): () => void {
  const { history, location } = env.window;
  const { pushState, replaceState } = history;
  let last = location.pathname;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const check = () => {
    timer = undefined;
    if (location.pathname === last) return;
    last = location.pathname;
    onChange(last);
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(check, 100);
  };

  history.pushState = function (this: History, ...args: Parameters<History['pushState']>) {
    pushState.apply(this, args);
    schedule();
  };
  history.replaceState = function (this: History, ...args: Parameters<History['replaceState']>) {
    replaceState.apply(this, args);
    schedule();
  };
  env.window.addEventListener('popstate', schedule);
  const observer = new env.window.MutationObserver(schedule);
  observer.observe(env.document.getElementById('react-root') ?? env.document.body, { childList: true, subtree: true });

  return () => {
    history.pushState = pushState;
    history.replaceState = replaceState;
    env.window.removeEventListener('popstate', schedule);
    observer.disconnect();
    clearTimeout(timer);
  };
}
