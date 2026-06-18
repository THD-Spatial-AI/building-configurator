import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Resolve the feedback-kit to the local sibling source tree when it is checked
// out alongside this repo (monorepo / linked-package dev workflow).  Otherwise
// fall back to the installed npm dist so that CI and production builds work
// without the sibling directory being present.
const localFeedbackKit = path.resolve(__dirname, '../feedback-kit/src/index.ts')
const feedbackKitResolved = existsSync(localFeedbackKit)
  ? localFeedbackKit
  : path.resolve(__dirname, 'node_modules/@thd-spatial-ai/feedback-kit/dist/index.js')

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
      '@thd-spatial-ai/feedback-kit': feedbackKitResolved,
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
