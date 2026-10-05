import { defineConfig } from '@playwright/test';

// The mock's port: 4173 by default; PORT=4175 npx playwright test runs a second copy (a git worktree) side by side.
const MOCK = `http://localhost:${process.env.PORT ?? 4173}`;

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  use: { browserName: 'chromium' },
  // The local course.link mock (scripts/serve.ts) serves the last `npm run build`.
  webServer: { command: 'npx tsx scripts/serve.ts', url: `${MOCK}/`, reuseExistingServer: true },
  projects: [
    { name: 'mock', testIgnore: /probe.*\.spec\.ts/, use: { baseURL: MOCK } },
    // Read-only checks against the real course.link site. Never logs in or changes anything.
    { name: 'live', testMatch: /probe.*\.spec\.ts/, use: { baseURL: 'https://cbgtraininginstitute.course.link' } },
  ],
});
