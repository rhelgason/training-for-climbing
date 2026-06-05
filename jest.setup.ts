// Jest setup — runs before each test file.
// @testing-library/react-native ships its own matchers since v12.4 (no jest-native needed).

// Keep test output clean: silence the app logger during tests.
// The logger reads this flag to switch to a no-op transport.
process.env.TFC_TEST = '1';
