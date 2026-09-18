import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
      // Point to local feedback-kit source in dev; the installed dist is used in CI/prod
      '@thd-spatial-ai/feedback-kit': path.resolve(__dirname, '../feedback-kit/src/index.ts'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // dist/ is the published package (see vite.lib.config.ts); the demo
  // application builds alongside it rather than over it.
  build: { outDir: 'dist-demo' },

  server: {
    // The EnerPlanET backend's CORS allowlist has http://localhost:5173
    // hardcoded (see enerplanet backend cmd/main.go), so this dev server
    // must actually be reachable there rather than silently drifting to
    // 5174+ when the port is busy — that would trade a clean CORS check for
    // an intermittent 403 with no port in the error message.
    port: 5173,
    strictPort: true,
    proxy: {
      // Keeps the browser same-origin with the EnerPlanET backend so its
      // session/csrf_token cookies aren't third-party — see enerplanetApi.ts.
      // Origin is left as-is (localhost:5173): it's already on the backend's
      // CORS allowlist, so no rewrite is needed here beyond changeOrigin's
      // own Host rewrite.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
