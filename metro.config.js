// Metro config for the Expo app in this npm-workspaces monorepo.
// The app lives at the repo root; @tfc/core is a workspace package under
// packages/core (symlinked into node_modules). Watch it and enable symlink
// resolution so Metro bundles its TypeScript directly.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.watchFolders = [__dirname, path.resolve(__dirname, 'packages')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
