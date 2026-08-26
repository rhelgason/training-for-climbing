// ESLint flat config (ESLint 9) for the repo root.
//
// There is nothing to lint at the root any more — the Expo app that used to
// live in `src/` is gone, and both workspaces lint themselves with their own
// configs (Next's for the web app, none needed for core's plain TypeScript).
// This exists so `npm run lint` at the root is a no-op that succeeds rather
// than an error, and so the ignore list stays in one obvious place.
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = [
  eslintConfigPrettier,
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      // Workspaces lint themselves with their own configs.
      'packages/**',
      'apps/**',
    ],
  },
];
