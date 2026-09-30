import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Runs against a real, throwaway PostgreSQL (see tests/support/global-setup.ts).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname),
      'server-only': path.resolve(import.meta.dirname, 'tests/support/empty.ts'),
    },
  },
  test: {
    include: ['tests/integration/**/*.spec.ts'],
    environment: 'node',
    globalSetup: ['tests/support/global-setup.ts'],
    setupFiles: ['tests/support/integration-setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
