// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions runs on Deno, which has its own globals and import style.
    ignores: ['anchor/src/client/js/generated/*', 'anchor/target/*', 'dist/*', 'supabase/functions/*'],
  },
])
