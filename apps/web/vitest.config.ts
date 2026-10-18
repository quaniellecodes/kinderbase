import { defineConfig } from 'vitest/config';

// Integration tests hit the live sandbox (RLS is the thing under test), so env
// from .env.local must load before any test runs, and they need a real network +
// a generous timeout for auth sign-in.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup-env.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['**/*.test.ts'],
  },
});
