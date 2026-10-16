import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the built arcade works from any sub-folder (itch.io, GitHub Pages, ...).
  base: './',
  server: { port: 5180, open: true },
  preview: { port: 5180 },
  build: {
    // three.js alone is ~550 kB minified (~140 kB gzipped); only the Trail Runner page loads it.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      // One page for the gallery, one per game. Add each new game's index.html here.
      input: {
        gallery: resolve(import.meta.dirname, 'index.html'),
        spaceInvaders: resolve(import.meta.dirname, 'games/space-invaders/index.html'),
        trailRunner: resolve(import.meta.dirname, 'games/trail-runner/index.html'),
      },
    },
  },
});
