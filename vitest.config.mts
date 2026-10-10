import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// The app's unit tests. The program's end-to-end tests have their own config in anchor/.
export default defineConfig({
  resolve: {
    alias: { '@project/anchor': fileURLToPath(new URL('./anchor/src', import.meta.url)) },
  },
})
