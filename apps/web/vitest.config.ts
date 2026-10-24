import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Node 25+ ships its own `localStorage` global, which shadows jsdom's and is
// undefined without a backing file. Older Node rejects the flag, so only pass
// it where it exists. CI runs Node 20 and never needed this.
const nodeMajor = Number(process.versions.node.split('.')[0]);
const execArgv = nodeMajor >= 25 ? ['--no-experimental-webstorage'] : [];

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  // Components rely on the automatic JSX runtime (as under Next/SWC), so no
  // explicit React import is needed in source files.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
    poolOptions: {
      forks: { execArgv },
      threads: { execArgv },
    },
  },
});
