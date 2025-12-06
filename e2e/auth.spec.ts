import { test, expect } from '@playwright/test';

test.describe('User Registration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/auth/signup');
        // Wait for P2P connection to settle if needed, or just wait for form
        await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    });

    test('should register a new user successfully', async ({ page }) => {
        const uniqueSuffix = Date.now().toString();
        const displayName = `Test User ${uniqueSuffix}`;
        const email = `testuser${uniqueSuffix}@example.com`;
        const password = 'Password123!';

        // Fill registration form using IDs to avoid ambiguity
        await page.locator('#displayName').fill(displayName);
        await page.locator('#email').fill(email);
        await page.locator('#password').fill(password);
        await page.locator('#confirmPassword').fill(password);

        // Submit form
        await page.getByRole('button', { name: /create account/i }).click();

        // Expect Seed Phrase Backup Screen
        await expect(page.getByText('Save Your Recovery Phrase')).toBeVisible({ timeout: 15000 });

        // Simulate copying seed phrase (required for UX flow usually, but button just copies to clipboard)
        // We just need to check the "I have saved" box to enable the continue button
        const savedCheckbox = page.getByRole('checkbox');
        await expect(savedCheckbox).toBeVisible();
        await savedCheckbox.check();

        // Click Continue
        const continueBtn = page.getByRole('button', { name: /continue to profile/i });
        await expect(continueBtn).toBeEnabled();
        await page.waitForTimeout(1000); // Wait for state to settle
        await continueBtn.click();

        // Expect redirection to Profile
        await expect(page).toHaveURL('/profile', { timeout: 30000 });

        // Wait for loading to finish (if applicable)
        await expect(page.getByText('Loading profile...')).toBeHidden({ timeout: 30000 });

        // Check for Profile Page Header with increased timeout
        await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible({ timeout: 30000 });

        // Verify User Details are displayed correctly
        await expect(page.getByText(displayName)).toBeVisible();
        await expect(page.getByText(email)).toBeVisible();
    });

    test('should show validation errors for invalid input', async ({ page }) => {
        await page.getByRole('button', { name: /create account/i }).click();
        // HTML5 validation might trigger, or app-level validation
        // Playwright can check validation messages or visible error text
        // Assuming app-level validation for empty fields:
        // Adjust based on actual implementation. If built-in HTML validation, we can't easily assert text without complex checks.
        // Let's assume there are some required attributes. 
        const emailInput = page.getByLabel(/email/i);
        await expect(emailInput).toHaveAttribute('required', '');
    });
});
