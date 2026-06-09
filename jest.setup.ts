// Jest setup — runs before each test file.
// @testing-library/react-native ships its own matchers since v12.4 (no jest-native needed).

// Keep test output clean: silence the app logger during tests.
// The logger reads this flag to switch to a no-op transport.
process.env.TFC_TEST = '1';

// In-memory AsyncStorage so cache/config-dependent code is testable.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest mock factories can't use ESM imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
