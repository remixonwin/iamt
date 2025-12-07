import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileViewer } from '@/shared/components/FileViewer';

// Mock URL class
const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();

const originalURL = global.URL;

class MockURL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
}

describe('FileViewer', () => {
    beforeAll(() => {
        global.URL = MockURL as any;
    });

    afterAll(() => {
        global.URL = originalURL;
    });

    const mockFile = {
        id: '1',
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        visibility: 'public' as const,
    };
    const mockBlob = new Blob(['content'], { type: 'text/plain' });
    const onClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        createObjectURL.mockReturnValue('blob:test-url');
    });

    it('should render file name and size', () => {
        render(<FileViewer file={mockFile} blob={mockBlob} onClose={onClose} />);
        expect(screen.getByText('test.txt')).toBeInTheDocument();
        // size 1024 is 1 KB (no decimal if integer result from parseFloat)
        expect(screen.getByText(/1 KB/)).toBeInTheDocument();
    });

    it('should handle text file preview', async () => {
        // Mock blob.text() separately since it's a promise
        const textBlob = new Blob(['Hello World'], { type: 'text/plain' });
        // @ts-ignore
        textBlob.text = () => Promise.resolve('Hello World');

        render(<FileViewer file={mockFile} blob={textBlob} onClose={onClose} />);

        await waitFor(() => {
            expect(screen.getByText('Hello World')).toBeInTheDocument();
        });
    });

    it('should render image preview', () => {
        const imageFile = { ...mockFile, type: 'image/png', name: 'img.png' };
        const imageBlob = new Blob([], { type: 'image/png' });

        render(<FileViewer file={imageFile} blob={imageBlob} onClose={onClose} />);
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'blob:test-url');
    });

    it('should call onClose when close button clicked', () => {
        render(<FileViewer file={mockFile} blob={mockBlob} onClose={onClose} />);
        const closeButton = screen.getByTitle('Close (Esc)');
        fireEvent.click(closeButton);
        expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose on Escape key', () => {
        render(<FileViewer file={mockFile} blob={mockBlob} onClose={onClose} />);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    it('should zoom image on + and - keys', () => {
        const imageFile = { ...mockFile, type: 'image/png', name: 'img.png' };
        render(<FileViewer file={imageFile} blob={mockBlob} onClose={onClose} />);

        const img = screen.getByRole('img');
        // Initial scale is likely 1 (not explicitly set in style initially but state is 1)

        fireEvent.keyDown(window, { key: '+' });
        expect(img).toHaveStyle({ transform: 'scale(1.25)' });

        fireEvent.keyDown(window, { key: '-' });
        expect(img).toHaveStyle({ transform: 'scale(1)' });
    });

    it('should render video preview', () => {
        const videoFile = { ...mockFile, type: 'video/mp4', name: 'vid.mp4' };
        const { container } = render(<FileViewer file={videoFile} blob={mockBlob} onClose={onClose} />);
        expect(container.querySelector('video')).toBeInTheDocument();
    });

    it('should render audio preview', () => {
        const audioFile = { ...mockFile, type: 'audio/mpeg', name: 'song.mp3' };
        // The audio preview renders a div with music note and separate audio element
        render(<FileViewer file={audioFile} blob={mockBlob} onClose={onClose} />);
        // Use getAllByText since filename appears in header and audio preview
        expect(screen.getAllByText('song.mp3').length).toBeGreaterThan(0);
        // Check for audio element
        // Note: screen.getByRole('audio') is not valid.
        const audio = document.querySelector('audio');
        expect(audio).toBeInTheDocument();
    });

    it('should render PDF preview', () => {
        const pdfFile = { ...mockFile, type: 'application/pdf', name: 'doc.pdf' };
        const { container } = render(<FileViewer file={pdfFile} blob={mockBlob} onClose={onClose} />);
        expect(container.querySelector('iframe')).toBeInTheDocument();
    });

    it('should render fallback for unknown type with download button', () => {
        const unknownFile = { ...mockFile, type: 'application/unknown', name: 'file.xyz' };
        render(<FileViewer file={unknownFile} blob={mockBlob} onClose={onClose} />);
        expect(screen.getByText('Preview not available for this file type.')).toBeInTheDocument();
        expect(screen.getByText('Download File')).toBeInTheDocument();
    });
});

