import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/home.css';
import './styles/course.css';
import './styles/motion.css';
import './styles/hazard.css';
import './styles/build80.css';
import './styles/course-motion.css';
import './styles/native-overrides.css';
import { detectPage, routeOf, type Page } from './pages';
import { watchRoutes } from './router';
import { failOpen, setupMotion, type Enhancer } from './motion/setup';

export type Teardown = () => void;
export type Setups = Record<Page['kind'], (page: Page) => Teardown>;

const noop = () => () => {};

// Home and course pages share the motion layer; each adds its own enhancers.
const motion = (enhancers: Enhancer[]) => () => {
  try {
    return setupMotion(document, enhancers);
  } catch (err) {
    failOpen(err);
    return () => {};
  }
};
// Page-specific enhancers live in their own chunk (one extra request, cached after the first page),
// so each page stays inside the 60 KB budget. A teardown before the chunk arrives cancels it.
const later = (load: () => Promise<{ enhancers: Enhancer[] }>): Enhancer => (roots) => {
  let undo: (() => void)[] = [];
  let dead = false;
  load()
    .then(({ enhancers }) => {
      if (dead) return;
      for (const enhance of enhancers) {
        try {
          const u = enhance(roots);
          if (u) undo.push(u);
        } catch (err) {
          console.warn('[cbg]', err);
        }
      }
    })
    .catch((err) => console.warn('[cbg]', err));
  return () => {
    dead = true;
    undo.forEach((f) => f());
    undo = [];
  };
};

const setups: Setups = {
  home: motion([later(() => import('./page-enhancers/home'))]),
  course: motion([later(() => import('./page-enhancers/course'))]),
  none: noop,
};

const warn = (err: unknown) => console.warn('[cbg]', err);

export function setRouteClass(root: HTMLElement, pathname: string) {
  root.classList.remove('cbg-route-home', 'cbg-route-course', 'cbg-route-none');
  root.classList.add('cbg-js', `cbg-route-${routeOf(pathname)}`);
}

export function pageSwitcher(setups: Setups, root: HTMLElement) {
  let teardown: Teardown | undefined;
  return (pathname: string) => {
    try {
      teardown?.();
    } catch (err) {
      warn(err);
    }
    teardown = undefined;
    try {
      const page = detectPage(pathname);
      setRouteClass(root, pathname);
      teardown = setups[page.kind](page);
    } catch (err) {
      warn(err);
    }
  };
}

function start() {
  const run = () => {
    try {
      const go = pageSwitcher(setups, document.documentElement);
      go(location.pathname);
      watchRoutes(go);
    } catch (err) {
      warn(err);
    }
  };
  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run, { once: true });
}

// The loader gives up after a timeout and marks <html> with cbg-off: content then shows in
// its final static state, so a late bundle must stay out of the way.
if (typeof window !== 'undefined') {
  try {
    (window as { __cbg?: number }).__cbg = 1;
    if (!document.documentElement.classList.contains('cbg-off')) start();
  } catch (err) {
    warn(err);
  }
}
