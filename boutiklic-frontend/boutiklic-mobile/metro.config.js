const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Force a single React instance: the monorepo hoists a newer react (used by
// boutiklic-frontend) to the root node_modules, while react-native 0.81.5
// expects the react version pinned locally in boutiklic-mobile. extraNodeModules
// only kicks in as a fallback, but react-native's own `require('react')` already
// resolves successfully to the hoisted root copy, so it never falls back — hence
// the resolveRequest override, which forces resolution to start from this app's
// own directory for every module, regardless of who is requiring it.
const forcedFromMobileRoot = new Set([
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
]);
const originModulePath = path.join(__dirname, 'package.json');
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (forcedFromMobileRoot.has(moduleName)) {
    const resolve = defaultResolveRequest || context.resolveRequest;
    return resolve({ ...context, originModulePath }, moduleName, platform);
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
