import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Read repo root `.env` so CONTROL_PLANE_HOST_PORT matches docker compose / your machine
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const cpPort =
    rootEnv.CONTROL_PLANE_HOST_PORT || process.env.CONTROL_PLANE_HOST_PORT || '4000';
  const catalogPort =
    rootEnv.CATALOG_HOST_PORT || process.env.CATALOG_HOST_PORT || '4055';
  const controlPlaneProxyTarget = `http://127.0.0.1:${cpPort}`;
  const catalogProxyTarget = `http://127.0.0.1:${catalogPort}`;

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }
            if (id.includes('recharts')) {
              return 'charts';
            }
            if (id.includes('framer-motion')) {
              return 'motion';
            }
            if (id.includes('/diff/')) {
              return 'diff-tools';
            }
            if (id.includes('react-router') || id.includes('@radix-ui') || id.includes('lucide-react')) {
              return 'ui-vendor';
            }
            return 'vendor';
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: controlPlaneProxyTarget,
          changeOrigin: true,
        },
        '/catalog': {
          target: catalogProxyTarget,
          changeOrigin: true,
          rewrite: (p) => (p.replace(/^\/catalog/, '') || '/') as string,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@agf-catalog': path.resolve(__dirname, '../catalog'),
      },
    },
  };
});
