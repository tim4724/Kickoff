import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { readFileSync } from 'fs'

const rootPkg = JSON.parse(
  readFileSync(resolve(dirname(__dirname), 'package.json'), 'utf-8')
)
const appVersion = process.env.APP_VERSION || rootPkg.version || '0.0.0'

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
  },
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
    // Keep vendor bundles (Phaser/Colyseus) out of the main chunk to avoid oversized output warnings
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          colyseus: ['colyseus.js'],
        },
      },
    },
    chunkSizeWarningLimit: 2000,
  },
})
