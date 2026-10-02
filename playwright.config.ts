import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  use: { browserName: 'chromium' },
  // The local course.link mock (scripts/serve.ts) serves the last `npm run build`.
  webServer: { command: 'npx tsx scripts/serve.ts', url: 'http://localhost:4173/', reuseExistingServer: true },
  projects: [
    { name: 'mock', testIgnore: /probe.*\.spec\.ts/, use: { baseURL: 'http://localhost:4173' } },
    // Read-only checks against the real course.link site. Never logs in or changes anything.
    { name: 'live', testMatch: /probe.*\.spec\.ts/, use: { baseURL: 'https://cbgtraininginstitute.course.link' } },
  ],
});
