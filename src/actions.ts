import type { Enhancer } from './motion/setup';

// The bits of the DOM the lookup needs, so tests can pass plain objects.
interface Node {
  textContent: string | null;
}
interface Root<N extends Node> {
  querySelectorAll(sel: string): Iterable<N>;
}

// course.link's own Login button: the navbar button labelled exactly "Login". No positional fallback:
// in a logged-in navbar the first button could be a user menu, and clicking that would be wrong.
// Undefined when there is none (e.g. logged in).
export function findLoginButton<N extends Node>(doc: Root<N>): N | undefined {
  for (const b of doc.querySelectorAll('#navbar button')) if (b.textContent?.trim() === 'Login') return b;
}

// [data-cbg-action="login"] (a link to #navbar) opens course.link's login popup by clicking its navbar
// Login button. Looked up on each click, since React can re-render the navbar. With no such button,
// the link keeps its default jump to the navbar.
export const loginAction: Enhancer = (roots) => {
  const off = new AbortController();
  const links = roots.flatMap((r) => [...r.querySelectorAll<HTMLElement>('[data-cbg-action="login"]')]);
  for (const link of links) {
    link.addEventListener(
      'click',
      (e) => {
        const button = findLoginButton(link.ownerDocument);
        if (!(button instanceof HTMLElement)) return;
        e.preventDefault();
        button.click();
      },
      { signal: off.signal },
    );
  }
  return () => off.abort();
};
