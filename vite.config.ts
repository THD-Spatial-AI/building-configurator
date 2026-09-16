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

  server: {
    proxy: {
      // Keeps the browser same-origin with the EnerPlanET backend so its
      // session/csrf_token cookies aren't third-party — see enerplanetApi.ts.
      //
      // changeOrigin only rewrites the outgoing Host header. The backend's
      // own CORS middleware (cfg.AppURL, see enerplanet backend cmd/main.go)
      // allowlists only its own frontend's origin, and Chrome sends a real
      // Origin header even on this same-origin-to-the-browser proxied
      // request — left as localhost:5173 it gets rejected 403 by that
      // allowlist. Rewritten here to the backend's own origin so its CORS
      // check sees a same-origin request, matching what changeOrigin
      // already does for Host.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('origin', 'http://localhost:8000');
          });
        },
      },
    },
  },
})
