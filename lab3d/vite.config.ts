// The 3D playground's dev server: models come from the site's public/three folder.
import { defineConfig } from 'vite';

export default defineConfig({ root: 'lab3d', publicDir: '../public', server: { fs: { allow: ['..'] } } });
