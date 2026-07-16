import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// NOTE offline : les tuiles (ortho IGN) sont mises en cache par le service worker
// en stratégie CacheFirst. Le pré-téléchargement d'une zone (voir src/lib/offline.ts)
// déclenche un fetch() de chaque tuile, ce qui remplit ce même cache — donc hors
// ligne la carte s'affiche depuis le cache.

// Base path configurable via l'env :
//  - Prod (domaine dédié, servi à la racine par nginx) : '/' (défaut)
//  - GitHub Pages projet (https://<org>.github.io/<repo>/) : '/web-field-annotator/'
// Définir VITE_BASE au moment du build pour surcharger.
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: 'Field Annotator — Kermap',
        short_name: 'FieldAnnotator',
        description:
          'Consultation ortho IGN hors ligne et logging d\'observations terrain',
        theme_color: '#0f766e',
        background_color: '#0b1220',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Permet à MapLibre (worker) de fonctionner offline
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: `${base}index.html`,
        // Fichiers de tuiles volumineux : on autorise un grand cache
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // Ortho IGN + services Géoplateforme (WMTS)
            urlPattern: /^https:\/\/data\.geopf\.fr\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tiles-ign',
              expiration: { maxEntries: 20000, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
