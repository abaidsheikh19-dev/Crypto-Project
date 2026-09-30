import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname),
      'server-only': path.resolve(import.meta.dirname, 'tests/support/empty.ts'),
    },
  },
  test: {
    include: ['tests/unit/**/*.spec.ts', 'tests/security/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lib/pricing.ts', 'src/lib/money.ts', 'src/lib/auth/totp.ts', 'src/lib/security/headers.ts'],
      thresholds: { 'src/lib/pricing.ts': { statements: 95, branches: 95, functions: 95, lines: 95 } },
    },
  },
});
