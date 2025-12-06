import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Live Production (Docker)
 * Targets existing server at port 3000.
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 1, // Serial execution for stability
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    // No webServer block - assume server is running
});
