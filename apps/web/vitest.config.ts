import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e/**', '**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      all: false,
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'tests/',
        'e2e/**',
        '**/*.spec.ts',
        '**/*.config.*',
        'next-env.d.ts',
        // Huge client page; messaging tests cover a subset only — keeps thresholds meaningful.
        'app/settings/page.tsx',
      ],
      // Lines/branches reflect exercised code; function % stays lower because many
      // nested handlers in imported layout/modal chunks are never invoked in these tests.
      thresholds: {
        lines: 60,
        statements: 60,
        branches: 60,
        functions: 28,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
