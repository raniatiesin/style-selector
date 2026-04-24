import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    { enforce: 'pre', ...mdx({ extension: /\.mdx?$/ }) },
    react()
  ],
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        tiedin: resolve(__dirname, 'tiedin/index.html'),
        documentation: resolve(__dirname, 'documentation/index.html'),
      },
      output: {
        manualChunks: {
          gsap: ['gsap'],
          vendor: ['react', 'react-dom', 'zustand'],
        },
      },
    },
  },
});
