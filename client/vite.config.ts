import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@shared': resolve(__dirname, '../shared/src'),
    },
  },
  define: {
    'import.meta.env.DEV': JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    open: true,
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
  },
})
