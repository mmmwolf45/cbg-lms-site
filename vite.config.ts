import { defineConfig } from 'vitest/config';

// The bundle is one JS entry (plus the CSS it imports). Hashed names are listed in
// dist/manifest.json by scripts/build-loader.ts, not Vite's own .vite/manifest.json.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/main.ts',
      output: {
        entryFileNames: 'cbg.[hash].js',
        assetFileNames: 'cbg.[hash][extname]',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
