// Web stub for react-native: only what the engines' import chain touches at load.
const noopSub = { remove() {} };
module.exports = {
  Platform: { OS: 'web', Version: 0, select: (o) => (o.web ?? o.default) },
  AppState: { currentState: 'active', addEventListener: () => noopSub },
};
