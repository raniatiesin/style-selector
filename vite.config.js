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
        
        if (req.url.startsWith('/GrossGauntlet/controls')) {
          req.url = '/GrossGauntlet/index.html';
        } else if (req.url.startsWith('/GrossGauntlet/overlays')) {
          req.url = '/GrossGauntlet/index.html';
        } else if (req.url.startsWith('/GrossGauntlet')) {
          req.url = '/GrossGauntlet/index.html';
        } else if (req.url.startsWith('/Logs')) {
          req.url = '/index.html';
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
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        GrossGauntlet: resolve(__dirname, 'GrossGauntlet/index.html'),
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
