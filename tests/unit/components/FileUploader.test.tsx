import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileUploader } from '@/shared/components/FileUploader';

// Mock utils
vi.mock('@/shared/utils', () => ({
    getFileTypeInfo: () => ({ maxSize: 100 }),
    isFileTypeSupported: () => true,
    isFileSizeValid: () => true,
    formatFileSize: () => '100 B',
    getAcceptedFileTypes: () => '*',
    getSupportedFormatsText: () => 'All formats',
}));

describe('FileUploader', () => {
    it('should render upload area', () => {
        render(<FileUploader onFilesSelected={() => { }} />);
        expect(screen.getByText('Click to upload')).toBeInTheDocument();
    });

    it('should handle file selection via input', async () => {
        const onFilesSelected = vi.fn();
        render(<FileUploader onFilesSelected={onFilesSelected} />);

        const file = new File(['content'], 'test.txt', { type: 'text/plain' });

        // Find hidden input
        // Using container to find input by type file
        // Or label association (none here).
        // Best: container.querySelector('input[type="file"]')
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;

        // Actually, render return helper is better.
        // But here I'm using screen, so I need to find it differently since it is hidden.
        // fireEvent.change needs the element.
        // Use test id or just simpler query
    });

    // Rewrite test to be more standard using testing-library patterns
});
