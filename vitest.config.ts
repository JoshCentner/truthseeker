import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'ui/tests/**/*.test.ts', 'src-pipeline/tests/**/*.test.ts', 'dashboard/tests/**/*.test.ts', 'src-corpus/tests/**/*.test.ts'],
    reporters: ['default'],
    slowTestThreshold: 1000,
  },
});
