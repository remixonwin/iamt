import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileUploader } from '@/shared/components/FileUploader';
import userEvent from '@testing-library/user-event';

// Mock utils
vi.mock '@/shared/utils', () => ({
    getFileTypeInfo: () => ({ maxSize: 100 }),
    isFileTypeSupported: (file: File) => !file.name.includes('unsupported'),
    isFileSizeValid: (file: File) => !file.name.includes('large'),
    formatFileSize: () => '100 B',
    getAcceptedFileTypes: () => '*',
    getSupportedFormatsText: () => 'All formats',
});

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');

describe('FileUploader', () => {
    const mockOnFilesSelected = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render upload area and visibility controls', () => {
        render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
        expect(screen.getByText('Click to upload')).toBeInTheDocument();
        expect(screen.getByText('Public')).toBeInTheDocument();
        expect(screen.getByText('Private')).toBeInTheDocument();
        expect(screen.getByText('Password')).toBeInTheDocument();
    });

    it('should handle file selection via input', async () => {
        const user = userEvent.setup();
        const { container } = render(<FileUploader onFilesSelected={mockOnFilesSelected} />);

        const file = new File(['content'], 'test.txt', { type: 'text/plain' });
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;

        await user.upload(input, file);

        expect(mockOnFilesSelected).toHaveBeenCalledTimes(1);
        expect(mockOnFilesSelected.mock.calls[0][0][0]).toMatchObject({
            file,
            visibility: 'public',
            status: 'pending'
        });
    });

    it('should handle drag and drop events', () => {
        render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
        const dropZone = screen.getByText('Click to upload').closest('div')!.parentElement!;

        // Drag over
        fireEvent.dragOver(dropZone);
        expect(screen.getByText('Drop files here')).toBeInTheDocument();

        // Drag leave
        fireEvent.dragLeave(dropZone);
        expect(screen.getByText('Click to upload')).toBeInTheDocument();

        // Drop
        const file = new File(['content'], 'dropped.txt', { type: 'text/plain' });
        fireEvent.drop(dropZone, {
            dataTransfer: {
                files: [file]
            }
        });

        expect(mockOnFilesSelected).toHaveBeenCalled();
    });

    it('should toggle visibility modes', async () => {
        const user = userEvent.setup();
        render(<FileUploader onFilesSelected={mockOnFilesSelected} />);

        // Default Public
        expect(screen.getByText('Anyone with the link can download this file')).toBeInTheDocument();

        // Switch to Private
        await user.click(screen.getByRole('button', { name: /private/i }));
        expect(screen.getByText('Only you can decrypt this file (key stored locally)')).toBeInTheDocument();

        // Switch to Password Protected
        await user.click(screen.getByRole('button', { name: /password/i }));
        expect(screen.getByText('Anyone with the password can decrypt this file')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter password for encryption')).toBeInTheDocument();
    });

    it('should validate password for password-protected files', async () => {
        const user = userEvent.setup();
        const { container } = render(<FileUploader onFilesSelected={mockOnFilesSelected} />);

        // Switch to Password Protected
        await user.click(screen.getByRole('button', { name: /password/i }));

        // Try uploading without password
        const file = new File(['content'], 'test.txt', { type: 'text/plain' });
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        await user.upload(input, file);

        expect(mockOnFilesSelected).not.toHaveBeenCalled();
        expect(screen.getByText('Please enter a password for password-protected files')).toBeInTheDocument();

        // Enter password and upload
        await user.type(screen.getByPlaceholderText('Enter password for encryption'), 'secret123');
        await user.upload(input, file);

        expect(mockOnFilesSelected).toHaveBeenCalled();
        expect(mockOnFilesSelected.mock.calls[0][0][0]).toMatchObject({
            visibility: 'password-protected',
            password: 'secret123'
        });
    });

    it('should handle validation errors (unsupported type)', async () => {
        const user = userEvent.setup();
        const { container } = render(<FileUploader onFilesSelected={mockOnFilesSelected} />);

        const file = new File(['content'], 'unsupported.exe', { type: 'application/x-msdownload' });
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;

        await user.upload(input, file);

        expect(mockOnFilesSelected).not.toHaveBeenCalled();
        expect(screen.getByText(/Unsupported file type/)).toBeInTheDocument();
    });

    it('should handle validation errors (file too large)', async () => {
        const user = userEvent.setup();
        const { container } = render(<FileUploader onFilesSelected={mockOnFilesSelected} />);

        const file = new File(['content'], 'large-file.mp4', { type: 'video/mp4' });
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;

        await user.upload(input, file);

        expect(mockOnFilesSelected).not.toHaveBeenCalled();
        expect(screen.getByText(/File too large/)).toBeInTheDocument();
    });
});
