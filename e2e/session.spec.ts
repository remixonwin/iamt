import { test, expect } from '@playwright/test';

test.describe('Session Persistence', () => {
    test('should persist authentication status after page reload', async ({ page }) => {
        // Generate unique user
        const timestamp = Date.now();
        const email = `session${timestamp}@example.com`;
        const password = 'Password123!';
        const displayName = `Session User ${timestamp}`;

        // 1. Register
        await page.goto('/auth/signup');
        await page.getByLabel('Email Address').fill(email);
        await page.getByLabel('Display Name').fill(displayName);
        await page.getByLabel('Password', { exact: true }).fill(password);
        await page.getByLabel('Confirm Password').fill(password);
        await page.getByRole('button', { name: 'Create Account' }).click();

        // 2. Complete Backup Flow
        await page.getByRole('button', { name: 'Copy to Clipboard' }).click();
        await page.getByRole('checkbox').check();
        await page.getByRole('button', { name: 'Continue to Profile' }).click();

        // 3. Verify Login
        await expect(page).toHaveURL('/profile');
        await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible({ timeout: 30000 });

        // 4. Reload Page (allow slower load)
        await page.reload({ waitUntil: 'domcontentloaded' });

        // 5. Verify Persistence (should NOT redirect to login)
        await expect(page).toHaveURL('/profile', { timeout: 30000 });
        await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(displayName)).toBeVisible({ timeout: 30000 });
    });
});
