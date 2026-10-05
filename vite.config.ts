import { defineConfig } from 'vitest/config';

// One JS entry plus one CSS file (all CSS is imported by the entry), and one lazy chunk per page
// (src/page-enhancers/*). Hashed entry names are listed in dist/manifest.json by
// scripts/build-loader.ts, not Vite's own .vite/manifest.json.
// base './': the bundle runs on course.link but lives on GitHub Pages, so chunks must be found
// relative to the entry's own URL, never to the page's origin.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: 'src/main.ts',
      output: {
        entryFileNames: 'cbg.[hash].js',
        chunkFileNames: 'cbg-[name].[hash].js',
        assetFileNames: 'cbg.[hash][extname]',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
