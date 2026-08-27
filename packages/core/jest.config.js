/** Jest config for @tfc/core — pure TypeScript, no UI framework. */
module.exports = {
  testEnvironment: 'node',
  watchman: false,
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'babel-jest',
      {
        // Self-contained: don't inherit any repo-root babel config.
        babelrc: false,
        configFile: false,
        presets: ['@babel/preset-typescript'],
        plugins: ['@babel/plugin-transform-modules-commonjs'],
      },
    ],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/index.ts'],
  /**
   * A floor, not a target. Set a few points under where the suite actually sits
   * (92/86/89/93 at the time of writing) so ordinary work doesn't trip it, but
   * a module landing with no tests at all does.
   *
   * This replaces a repo-root threshold of 20%, which was only that low because
   * it averaged in a React Native app whose screens were largely untested. With
   * that gone the number can mean something.
   */
  coverageThreshold: {
    global: {
      statements: 88,
      branches: 82,
      functions: 85,
      lines: 90,
    },
  },
};
