import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import { resolve } from 'path';

// This plugin mimics our vercel.json rewrites for local dev
function vercelRewritesPlugin() {
  return {
    name: 'vercel-rewrites',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Allow direct requests to assets to pass through
        if (req.url.includes('.')) return next();
        
        if (req.url.startsWith('/tiedin/controls')) {
          req.url = '/tiedin/index.html';
        } else if (req.url.startsWith('/tiedin/overlays')) {
          req.url = '/tiedin/index.html';
        } else if (req.url.startsWith('/tiedin')) {
          req.url = '/documentation/index.html';
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [
    vercelRewritesPlugin(),
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
