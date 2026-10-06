import { test } from '@playwright/test';

// The page background (src/motion/sky.ts: the waves and the night sky) draws a full-screen shader up to 30
// times a second for as long as the page is open. Headless Chromium renders WebGL in software (SwiftShader), so with the suite's parallel
// workers the sky alone saturates the CPU and stalls the pages of specs that time scroll-driven motion
// (renderers stop answering for 30 s). Those specs test motion that has nothing to do with the sky, so
// they run without it, as a browser where the sky's WebGL fails sees the page (the still gradient stays).
export function withoutSky() {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return this.classList.contains('cbg-sky') ? null : (get as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof get;
    });
  });
}
