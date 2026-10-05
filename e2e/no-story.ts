import { test } from '@playwright/test';

// The courses story (src/motion/course-story.ts) replaces the card gallery whenever motion is allowed. Specs
// for the gallery and its gold track (its fallback) run it as a browser without canvas 2D sees the page.
// noStory is the init script itself, for pages in a context a spec opens on its own.
export const noStory = () => {
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
    return this.classList.contains('cbg-story__canvas') ? null : (get as (...a: unknown[]) => unknown).call(this, type, ...rest);
  } as typeof get;
};
export const withoutStory = () => test.beforeEach(({ page }) => page.addInitScript(noStory));
