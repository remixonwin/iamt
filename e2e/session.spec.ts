import { test, expect } from '@playwright/test';

test.describe('Session Persistence', () => {
    test('should persist authentication status after page reload', async ({ page }) => {
        // Generate unique user
        const timestamp = Date.now();
        const email = `session${timestamp}@example.com`;
        const password = 'Password123!';
        const displayName = `Session User ${timestamp}`;

        // 1. Register using ID selectors for reliability
        await page.goto('/auth/signup');
        await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
        await page.locator('#email').fill(email);
        await page.locator('#displayName').fill(displayName);
        await page.locator('#password').fill(password);
        await page.locator('#confirmPassword').fill(password);
        await page.getByRole('button', { name: /create account/i }).click();

        // 2. Complete Backup Flow - wait for seed phrase screen
        await expect(page.getByText('Save Your Recovery Phrase')).toBeVisible({ timeout: 15000 });
        await page.getByRole('checkbox').check();
        await page.getByRole('button', { name: /continue to profile/i }).click();

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
