import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'ui/tests/**/*.test.ts'],
    reporters: ['default'],
    slowTestThreshold: 1000,
  },
});
