const { existsSync } = require('node:fs');
const { join } = require('node:path');

// `google-services.json` is a build-time credential owned by the student and is
// never committed. The Firebase Gradle plugin is enabled only when the file is
// present, so local builds without a Firebase project still succeed.
module.exports = ({ config }) => {
  const googleServicesFile = join(__dirname, 'google-services.json');
  return {
    ...config,
    android: {
      ...config.android,
      ...(existsSync(googleServicesFile) ? { googleServicesFile } : {}),
    },
  };
};
