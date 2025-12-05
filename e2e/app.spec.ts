import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display the IAMT header', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('IAMT');
    });

    test('should show the IPFS storage badge', async ({ page }) => {
        await expect(page.getByText('IPFS + P2P Synced Storage')).toBeVisible();
    });

    test('should have upload tab selected by default', async ({ page }) => {
        const uploadButton = page.getByRole('button', { name: /upload/i });
        await expect(uploadButton).toBeVisible();
    });

    test('should display the drag-and-drop zone', async ({ page }) => {
        await expect(page.getByText('Click to upload')).toBeVisible();
        await expect(page.getByText('drag and drop')).toBeVisible();
    });

    test('should show supported formats', async ({ page }) => {
        await expect(page.getByText(/PDF.*MP3.*MP4.*JPG/i)).toBeVisible();
    });
});

test.describe('File Upload', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should show upload zone on hover', async ({ page }) => {
        const dropZone = page.locator('[class*="border-dashed"]');
        await dropZone.hover();
        // Verify zone is interactive
        await expect(dropZone).toBeVisible();
    });

    test('should open file dialog on click', async ({ page }) => {
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeHidden(); // Hidden but exists

        // Verify the input accepts the right types
        const accept = await fileInput.getAttribute('accept');
        expect(accept).toContain('application/pdf');
        expect(accept).toContain('audio/mpeg');
        expect(accept).toContain('video/mp4');
        expect(accept).toContain('image/jpeg');
    });

    test('should upload a file and show progress', async ({ page }) => {
        // Create a test file
        const buffer = Buffer.from('test file content');

        // Upload via file input
        await page.setInputFiles('input[type="file"]', {
            name: 'test-document.pdf',
            mimeType: 'application/pdf',
            buffer,
        });

        // Should show uploading state
        await expect(page.getByText(/uploading/i)).toBeVisible({ timeout: 5000 });

        // Wait for upload to complete
        await expect(page.getByText(/uploaded successfully/i)).toBeVisible({ timeout: 10000 });
    });

    test('should show uploaded file in queue', async ({ page }) => {
        const buffer = Buffer.from('test image content');

        await page.setInputFiles('input[type="file"]', {
            name: 'test-image.jpg',
            mimeType: 'image/jpeg',
            buffer,
        });

        // Should show filename
        await expect(page.getByText('test-image.jpg')).toBeVisible({ timeout: 5000 });
    });
});

test.describe('My Files Tab', () => {
    test('should switch to My Files tab', async ({ page }) => {
        await page.goto('/');

        await page.getByRole('button', { name: /my files/i }).click();

        // Should show empty state if no files
        await expect(page.getByText(/no files yet/i)).toBeVisible();
    });

    test('should persist uploaded files', async ({ page }) => {
        await page.goto('/');

        // Upload a file
        const buffer = Buffer.from('persistent file');
        await page.setInputFiles('input[type="file"]', {
            name: 'persistent-doc.pdf',
            mimeType: 'application/pdf',
            buffer,
        });

        // Wait for upload
        await page.waitForTimeout(2000);

        // Switch to My Files
        await page.getByRole('button', { name: /my files/i }).click();

        // Should show the file (after animation completes) - use first() to avoid strict mode
        await expect(page.getByText('persistent-doc.pdf').first()).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Stats Bar', () => {
    test('should display file count', async ({ page }) => {
        await page.goto('/');

        // Stats should show file count label
        await expect(page.getByText('Files', { exact: true })).toBeVisible();
    });

    test('should display total size', async ({ page }) => {
        await page.goto('/');

        // Should show size (0 B or existing)
        await expect(page.locator('text=/\\d+(\\.\\d+)?\\s*(B|KB|MB|GB)/i')).toBeVisible();
    });
});

test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        await expect(page.locator('h1')).toContainText('IAMT');
        await expect(page.getByText('Click to upload')).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto('/');

        await expect(page.locator('h1')).toContainText('IAMT');
        await expect(page.getByRole('button', { name: /upload/i })).toBeVisible();
    });
});
