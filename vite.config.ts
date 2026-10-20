import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

// `npm run dev:phone` serves over self-signed HTTPS on your LAN, because phone
// browsers only allow camera access on HTTPS pages.
export default defineConfig(({ mode }) => ({
  build: { chunkSizeWarningLimit: 700 },
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === 'phone' ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Flower Dome Stamp Rally',
        short_name: 'Stamp Rally',
        theme_color: '#1f5f3a',
        background_color: '#f6f8ef',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Uploaded photos never change once stored, so serve them from cache.
            urlPattern: /\/storage\/v1\/object\/public\//,
            handler: 'CacheFirst',
            options: { cacheName: 'photos', expiration: { maxEntries: 300 } },
          },
        ],
      },
    }),
  ],
}))
