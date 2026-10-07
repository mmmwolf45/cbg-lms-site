import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/home.css';
import './styles/ribbon.css';
import './styles/dock.css';
import './styles/course.css';
import './styles/motion.css';
import './styles/night.css';
import './styles/hazard.css';
import './styles/build80.css';
import './styles/course-motion.css';
import './styles/qs.css';
import './styles/scrub.css';
import './styles/xray.css';
import './styles/hero-options.css';
import './styles/bowtie.css';
import './styles/native-overrides.css';
import './styles/sky.css';
import { routeOf, type Route } from './pages';
import { watchRoutes } from './router';
import { failOpen, failed, setupMotion, type Enhancer } from './motion/setup';
import { skyBackground } from './motion/sky';

export type Teardown = () => void;
export type Setups = Record<Route, () => Teardown>;

const warn = (err: unknown) => console.warn('[cbg]', err);

// Page-specific enhancers live in their own chunk (one extra request, cached after the first page),
// so each page stays inside the 60 KB budget. A teardown before the chunk arrives cancels it.
// If the chunk can't load (e.g. an old hash after a deploy) or an enhancer throws, fail open.
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
          failOpen(err);
        }
      }
    })
    .catch((err) => dead || failOpen(err));
  return () => {
    dead = true;
    undo.forEach((f) => f());
    undo = [];
  };
};

// Home and course pages share the motion layer; each adds its own enhancers.
const motion = (load: () => Promise<{ enhancers: Enhancer[] }>) => () => {
  try {
    return setupMotion(document, [later(load)]);
  } catch (err) {
    failOpen(err);
    return () => {};
  }
};

const setups: Setups = {
  home: motion(() => import('./page-enhancers/home')),
  course: motion(() => import('./page-enhancers/course')),
  none: () => () => {},
};

export function setRouteClass(root: HTMLElement, pathname: string) {
  root.classList.remove('cbg-route-home', 'cbg-route-course', 'cbg-route-none');
  root.classList.add(`cbg-route-${routeOf(pathname)}`);
  if (!failed) root.classList.add('cbg-js');
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
      setRouteClass(root, pathname);
      teardown = setups[routeOf(pathname)]();
    } catch (err) {
      warn(err);
    }
  };
}

function start() {
  const run = () => {
    try {
      const root = document.documentElement;
      const go = pageSwitcher(setups, root);
      go(location.pathname);
      watchRoutes(go, undefined, (path) => setRouteClass(root, path));
    } catch (err) {
      warn(err);
    }
    try {
      skyBackground(); // the waves and the stars; if it fails, the still gradient stays
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
