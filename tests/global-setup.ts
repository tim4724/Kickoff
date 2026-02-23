import { FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  return async () => {
    console.log('✅ Global teardown complete')
  }
}

export default globalSetup
