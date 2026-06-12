const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// AppCheckCore (pulled in by Firebase/GoogleSignIn) is a Swift pod that depends
// on GoogleUtilities and RecaptchaInterop, which don't define modules.
// CocoaPods requires :modular_headers => true on those two pods so they can be
// imported from Swift when building as static libraries.
module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );
      let contents = fs.readFileSync(podfilePath, 'utf-8');

      const snippet = [
        "  pod 'GoogleUtilities', :modular_headers => true",
        "  pod 'RecaptchaInterop', :modular_headers => true",
      ].join('\n');

      if (!contents.includes("pod 'GoogleUtilities'")) {
        // Insert right after the opening "target 'Athlr' do" line
        contents = contents.replace(
          /(target ['"]Athlr['"] do\n)/,
          `$1${snippet}\n`
        );
        fs.writeFileSync(podfilePath, contents);
      }

      return config;
    },
  ]);
};
