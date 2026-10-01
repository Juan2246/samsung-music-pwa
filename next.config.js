/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Needed for Next.js 16 which has Turbopack as default
  turbopack: {},
};

// Only wrap with PWA plugin when building for production.
// @ducanh2912/next-pwa es un plugin de webpack: por eso `npm run build` usa
// `next build --webpack`. Con Turbopack el build pasa, pero sin service worker.
if (process.env.NODE_ENV === 'production') {
  const withPWA = require('@ducanh2912/next-pwa').default({
    dest: 'public',
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    extendDefaultRuntimeCaching: true,
    workboxOptions: {
      disableDevLogs: true,
      runtimeCaching: [
        {
          // Reemplaza la regla "apis" por defecto (NetworkFirst con caché de 24 h):
          // no tiene sentido guardar en caché búsquedas, letras ni, sobre todo,
          // el audio completo de cada canción que devuelve /api/youtube-audio.
          urlPattern: ({ sameOrigin, url: { pathname } }) => sameOrigin && pathname.startsWith('/api/'),
          handler: 'NetworkOnly',
          method: 'GET',
          options: { cacheName: 'apis' },
        },
      ],
    },
  });
  module.exports = withPWA(nextConfig);
} else {
  module.exports = nextConfig;
}
