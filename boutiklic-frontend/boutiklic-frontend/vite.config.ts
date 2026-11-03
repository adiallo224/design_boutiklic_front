import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'BOUTIKLIC',
        short_name: 'Boutiklic',
        description: 'Caisse intelligente pour petits commerçants',
        theme_color: '#0E2038',
        background_color: '#FBF8F2',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        // Le bundle principal pèse ~2,1 Mo. Au-delà de la limite par défaut (2 MiB) la PWA NE LE PRÉ-CHARGE PLUS: l'application ne démarrerait plus hors ligne, alors que le
        // mode hors ligne est central. Les écrans de la boutique en ligne sont de plus chargés à la demande (React.lazy) pour ne pas gonfler ce bundle.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.boutiklic\.com\/api\/v1\/products/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'products-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 86400 }
            }
          },
          {
            urlPattern: /^https:\/\/api\.boutiklic\.com\/api\/v1\/sales/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sales-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 3600 }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api/v1')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
