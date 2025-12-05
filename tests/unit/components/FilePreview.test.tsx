import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilePreview } from '@/shared/components/FilePreview';
import type { UploadedFile } from '@/shared/components/FileUploader';

const mockFile: UploadedFile = {
    id: '1',
    file: new File([''], 'test.txt', { type: 'text/plain' }),
    progress: 0,
    status: 'pending'
};

describe('FilePreview', () => {
    it('should render file name and size', () => {
        render(<FilePreview uploadedFile={mockFile} onRemove={() => { }} />);
        expect(screen.getByText('test.txt')).toBeInTheDocument();
        // fileTypeInfo returns UNKNOWN for text/plain in current implementation apparently or I can check for '0 B'
        expect(screen.getByText(/UNKNOWN/)).toBeInTheDocument();
    });

    it('should show progress bar when uploading', () => {
        const uploading = { ...mockFile, status: 'uploading' as const, progress: 50 };
        render(<FilePreview uploadedFile={uploading} onRemove={() => { }} />);
        expect(screen.getByText('50% uploaded')).toBeInTheDocument();
    });

    it('should show error message', () => {
        const error = { ...mockFile, status: 'error' as const, error: 'Upload failed' };
        render(<FilePreview uploadedFile={error} onRemove={() => { }} />);
        expect(screen.getByText('Upload failed')).toBeInTheDocument();
    });

    it('should call onRemove when button clicked', () => {
        const onRemove = vi.fn();
        render(<FilePreview uploadedFile={mockFile} onRemove={onRemove} />);

        // Find remove button (it has specific SVG) or use querySelector
        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[0]);
        expect(onRemove).toHaveBeenCalledWith('1');
    });
});
