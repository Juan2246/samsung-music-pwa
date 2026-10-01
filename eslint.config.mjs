import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      // Las portadas vienen de CDNs externos (iTunes, Spotify, YouTube) y se muestran
      // pequeñas; next/image obligaría a pasar cada una por el optimizador del servidor.
      '@next/next/no-img-element': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Service worker y Workbox que genera @ducanh2912/next-pwa al compilar
    'public/sw.js',
    'public/workbox-*.js',
    'public/swe-worker-*.js',
    'public/fallback-*.js',
  ]),
]);

export default eslintConfig;
