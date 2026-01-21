import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { readFileSync } from 'fs'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'

const rootPkg = JSON.parse(
  readFileSync(resolve(dirname(__dirname), 'package.json'), 'utf-8')
)
const appVersion = process.env.APP_VERSION || rootPkg.version || '0.0.0'

// Determine app name based on branch/environment
// Production branches show "Kickoff", feature branches show just the branch name
const branch = process.env.VITE_BRANCH || process.env.BRANCH || ''
const branchLower = branch.toLowerCase()
const isProduction = !branch || branchLower === 'main' || branchLower === 'master' || branchLower === 'production'
// Sanitize branch name: remove special chars, limit length
const sanitizedBranch = branch.replace(/[^a-zA-Z0-9-_/]/g, '').slice(0, 20) || 'preview'
const appName = isProduction ? 'Kickoff' : sanitizedBranch
const shortName = isProduction ? 'Kickoff' : sanitizedBranch.slice(0, 12)

// Plugin to replace %VITE_APP_NAME% in HTML
function htmlAppNamePlugin(): Plugin {
  return {
    name: 'html-app-name',
    transformIndexHtml(html) {
      return html.replace(/%VITE_APP_NAME%/g, appName)
    },
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@shared': resolve(__dirname, '../shared/src'),
    },
  },
  define: {
    'import.meta.env.DEV': JSON.stringify(process.env.NODE_ENV !== 'production'),
    // Pass server port to client code (for test vs dev environments)
    'import.meta.env.VITE_SERVER_PORT': JSON.stringify(
      process.env.VITE_SERVER_PORT || '3000'
    ),
    'import.meta.env.APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.COMMIT_HASH': JSON.stringify(process.env.COMMIT_HASH || ''),
    'import.meta.env.VITE_BRANCH': JSON.stringify(branch),
    'import.meta.env.APP_NAME': JSON.stringify(appName),
  },
  plugins: [
    htmlAppNamePlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: appName,
        short_name: shortName,
        description: 'Fast-paced multiplayer arcade soccer',
        theme_color: '#00ff00',
        background_color: '#1a1a1a',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: [], // Don't precache - prioritize fresh content
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // HTML: Network first, fall back to cache
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 3,
            },
          },
          {
            // JS/CSS: Network first for fresh code
            urlPattern: ({ request }) =>
              request.destination === 'script' || request.destination === 'style',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'assets-cache',
              networkTimeoutSeconds: 3,
            },
          },
          {
            // Images: Cache first (they don't change often)
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 5173,
    host: '0.0.0.0',
    open: !process.env.VITE_PORT, // Don't auto-open when using custom port (test mode)
    // Configure for parallel test execution
    hmr: {
      overlay: false, // Disable error overlay for cleaner tests
    },
    // Increase connection limits for concurrent testing
    cors: true,
    strictPort: false,
  },
  // Optimize for faster cold starts during parallel testing
  optimizeDeps: {
    force: false, // Don't force re-optimization
    esbuildOptions: {
      target: 'es2020',
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    // Keep vendor bundles (PixiJS/Colyseus) out of the main chunk to avoid oversized output warnings
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
          colyseus: ['colyseus.js'],
        },
      },
    },
    chunkSizeWarningLimit: 2000,
  },
})
