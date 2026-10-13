import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: resolve(import.meta.dirname, '../..'),
  test: {
    include: ['tools/corpus/run.spec.ts'],
    testTimeout: 3_600_000,
    hookTimeout: 600_000,
    reporters: ['verbose'],
  },
});
