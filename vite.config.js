import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app at https://graytrees.github.io/GraytTrees/
const base = process.env.BASE_PATH || '/GraytTrees/';

export default defineConfig({
  base,
  plugins: [VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon-192.png', 'icon-512.png'],
    manifest: {
      name: 'GraytTrees Bonsai', short_name: 'GraytTrees', description: 'Private bonsai collection records',
      start_url: base, scope: base, display: 'standalone', orientation: 'portrait-primary',
      background_color: '#ECEEE9', theme_color: '#2E5B5F',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg}'],
      navigateFallback: base + 'index.html',
      runtimeCaching: [{ urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, handler: 'CacheFirst', options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 31536000 } } }],
    },
  })],
});
