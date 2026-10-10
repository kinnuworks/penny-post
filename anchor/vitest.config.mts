import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { BaseSequencer, type TestSpecification } from 'vitest/node'

// The test files share one local validator and build on each other's state:
// the first opens the post office, the second uses it. So they run one at a
// time, in name order.
class InNameOrder extends BaseSequencer {
  async sort(files: TestSpecification[]) {
    return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId))
  }
}

export default defineConfig({
  resolve: {
    alias: { '@project/anchor': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    fileParallelism: false,
    // Setup in the second file waits out a ten-second stall in the validator.
    hookTimeout: 60_000,
    include: ['tests/**/*.test.ts'],
    sequence: { sequencer: InNameOrder },
  },
})
