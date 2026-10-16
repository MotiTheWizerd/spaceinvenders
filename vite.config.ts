import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the built game works from any sub-folder (itch.io, GitHub Pages, ...).
  base: './',
  server: { port: 5180, open: true },
  preview: { port: 5180 },
});
