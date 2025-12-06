import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Production Build
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    // Run PRODUCTION server before starting tests
    webServer: {
        command: 'NEXT_PUBLIC_STORAGE_API=http://localhost:3001 npm start',
        url: 'http://localhost:3000',
        reuseExistingServer: false, // Don't reuse dev server, force start new prod server
        timeout: 120 * 1000,
    },
});
