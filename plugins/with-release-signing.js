// Signs release builds with the project's own keystore.
//
// Expo regenerates the android folder on every prebuild, so the signing setup
// cannot live there. This plugin writes it into the generated build.gradle.
// The keystore and its passwords are read from the environment at build time
// and are never written to a file in this repository:
//
//   PENNY_POST_KEYSTORE            absolute path to the .jks file
//   PENNY_POST_KEYSTORE_PASSWORD
//   PENNY_POST_KEY_ALIAS
//   PENNY_POST_KEY_PASSWORD
//
// Without them a release build is signed with the debug key, which the Solana
// dApp Store rejects. The build prints a warning when that happens.

const { withAppBuildGradle } = require('expo/config-plugins')

const RELEASE_CONFIG = `
        release {
            if (System.getenv("PENNY_POST_KEYSTORE")) {
                storeFile file(System.getenv("PENNY_POST_KEYSTORE"))
                storePassword System.getenv("PENNY_POST_KEYSTORE_PASSWORD")
                keyAlias System.getenv("PENNY_POST_KEY_ALIAS")
                keyPassword System.getenv("PENNY_POST_KEY_PASSWORD")
            } else {
                logger.warn("PENNY_POST_KEYSTORE is not set. This release build is signed with the debug key.")
            }
        }`

const DEBUG_BLOCK = /(signingConfigs \{\s*debug \{[^}]*\})/
const RELEASE_USES_DEBUG = /(release \{[^}]*?)signingConfig signingConfigs\.debug/

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (gradle) => {
    let contents = gradle.modResults.contents
    if (contents.includes('PENNY_POST_KEYSTORE')) {
      return gradle
    }
    if (!DEBUG_BLOCK.test(contents) || !RELEASE_USES_DEBUG.test(contents)) {
      throw new Error('with-release-signing: build.gradle no longer looks the way this plugin expects.')
    }
    contents = contents.replace(DEBUG_BLOCK, `$1${RELEASE_CONFIG}`)
    contents = contents.replace(
      RELEASE_USES_DEBUG,
      '$1signingConfig System.getenv("PENNY_POST_KEYSTORE") ? signingConfigs.release : signingConfigs.debug',
    )
    gradle.modResults.contents = contents
    return gradle
  })
}

module.exports = withReleaseSigning
