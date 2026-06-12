/**
 * Applies the react-native-health config plugin on iOS only.
 * react-native-health is HealthKit-only — including it on Android crashes Gradle.
 */
module.exports = function withHealthKitiOS(config, options) {
  if (process.env.EAS_BUILD_PLATFORM === 'android') {
    return config;
  }
  const withHealth = require('react-native-health/app.plugin');
  return withHealth(config, options);
};
