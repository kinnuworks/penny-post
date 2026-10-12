// Lets a release build talk to a validator on the developer's own machine.
//
// Android refuses plain HTTP in release builds. A phone or emulator reaches a
// local validator at http://localhost:8899 through `adb reverse`, so that one
// host is allowed, and nothing else is. Every real network the app uses is
// HTTPS and is not affected.

const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins')
const fs = require('node:fs')
const path = require('node:path')

const CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">localhost</domain>
    </domain-config>
</network-security-config>
`

function withLocalhostCleartext(config) {
  config = withDangerousMod(config, [
    'android',
    (modConfig) => {
      const folder = path.join(modConfig.modRequest.platformProjectRoot, 'app/src/main/res/xml')
      fs.mkdirSync(folder, { recursive: true })
      fs.writeFileSync(path.join(folder, 'network_security_config.xml'), CONFIG)
      return modConfig
    },
  ])
  return withAndroidManifest(config, (manifest) => {
    const application = manifest.modResults.manifest.application?.[0]
    if (application) {
      application.$['android:networkSecurityConfig'] = '@xml/network_security_config'
    }
    return manifest
  })
}

module.exports = withLocalhostCleartext
