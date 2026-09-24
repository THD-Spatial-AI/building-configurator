import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Library build. Tailwind is absent on purpose: the utility classes in this
 * component are compiled by the host's own Tailwind pass, which scans the
 * published dist (see the @source line in README.md). Compiling them here
 * would ship a second copy of the utilities and freeze them against this
 * repo's palette instead of the host's.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  build: {
    outDir: 'dist',
    // No sourcemaps in the published package: they were two thirds of it, and
    // they only help someone stepping into this library's own internals.
    sourcemap: false,
    lib: {
      entry: {
        index: path.resolve(__dirname, 'src/index.ts'),
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
    rollupOptions: {
      // Everything a host already has, or would otherwise end up duplicated in
      // its bundle. React must be external for hooks to resolve to the host's
      // own copy at all.
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'lucide-react',
        'clsx',
        'tailwind-merge',
        'fflate',
        // Declared dependencies, so a host installing this package gets them
        // without a second copy of three in its bundle.
        'three',
        /^three\//,
        'earcut',
        /^@radix-ui\//,
      ],
    },
  },
});
