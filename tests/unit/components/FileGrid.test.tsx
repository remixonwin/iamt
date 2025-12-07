import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileGrid } from '@/shared/components/FileGrid';

// Default mock files
const mockFiles = [
    { id: '1', name: 'test1.txt', size: 1024, type: 'text/plain', uploadedAt: Date.now(), visibility: 'public' as const },
    { id: '2', name: 'image.png', size: 5000, type: 'image/png', preview: 'blob:img', uploadedAt: Date.now(), visibility: 'private' as const },
];

describe('FileGrid', () => {
    it('should render correct number of files', () => {
        render(<FileGrid files={mockFiles} onDelete={() => { }} onPreview={() => { }} />);
        expect(screen.getByText('test1.txt')).toBeInTheDocument();
        expect(screen.getByText('image.png')).toBeInTheDocument();
    });

    it('should show empty state when no files', () => {
        render(<FileGrid files={[]} onDelete={() => { }} onPreview={() => { }} />);
        expect(screen.getByText('No files yet')).toBeInTheDocument();
    });

    it('should call onPreview when file clicked', () => {
        const onPreview = vi.fn();
        render(<FileGrid files={mockFiles} onDelete={() => { }} onPreview={onPreview} />);

        fireEvent.click(screen.getByText('test1.txt'));
        expect(onPreview).toHaveBeenCalledWith('1');
    });

    it('should call onDelete when delete button clicked', () => {
        const onDelete = vi.fn();
        render(<FileGrid files={mockFiles} onDelete={onDelete} onPreview={() => { }} />);

        // Find delete button by aria-label
        const deleteButton = screen.getByLabelText('Delete test1.txt');
        fireEvent.click(deleteButton);
        expect(onDelete).toHaveBeenCalledWith('1');
    });

    it('should render video preview correctly', () => {
        const videoFile = [{
            id: '3', name: 'movie.mp4', size: 10000, type: 'video/mp4', preview: 'blob:video',
            uploadedAt: Date.now(), visibility: 'public' as const
        }];
        const { container } = render(<FileGrid files={videoFile} onDelete={() => { }} onPreview={() => { }} />);
        const video = container.querySelector('video');
        expect(video).toBeInTheDocument();
        expect(video).toHaveAttribute('src', 'blob:video');
    });

    it('should render audio preview correctly', () => {
        const audioFile = [{
            id: '4', name: 'song.mp3', size: 500, type: 'audio/mpeg', preview: 'blob:audio',
            uploadedAt: Date.now(), visibility: 'public' as const
        }];
        const { container } = render(<FileGrid files={audioFile} onDelete={() => { }} onPreview={() => { }} />);
        const audio = container.querySelector('audio');
        expect(audio).toBeInTheDocument();
        expect(audio).toHaveAttribute('src', 'blob:audio');
    });

    it('should render PDF placeholder correctly', () => {
        const pdfFile = [{
            id: '5', name: 'doc.pdf', size: 2000, type: 'application/pdf', preview: 'blob:pdf',
            uploadedAt: Date.now(), visibility: 'public' as const
        }];
        render(<FileGrid files={pdfFile} onDelete={() => { }} onPreview={() => { }} />);
        expect(screen.getByText('Click to view')).toBeInTheDocument();
    });

    it('should display correct badges for visibility', () => {
        const files = [
            { id: 'p1', name: 'private.txt', size: 1, type: 'text', uploadedAt: 0, visibility: 'private' as const },
            { id: 'p2', name: 'pwd.txt', size: 1, type: 'text', uploadedAt: 0, visibility: 'password-protected' as const },
        ];
        render(<FileGrid files={files} onDelete={() => { }} onPreview={() => { }} />);
        expect(screen.getByText('Private')).toBeInTheDocument();
        expect(screen.getByText('PWD')).toBeInTheDocument();
    });

    it('should display encrypted warning if cannot decrypt', () => {
        const file = [{
            id: 'Enc', name: 'secret.txt', size: 100, type: 'text/plain', uploadedAt: 0,
            visibility: 'private' as const, encrypted: true, canDecrypt: false
        }];
        render(<FileGrid files={file} onDelete={() => { }} onPreview={() => { }} />);
        expect(screen.getByText('🔒 Locked')).toBeInTheDocument();
    });

    it('should display uploader info for public files with owner', () => {
        const file = [{
            id: 'pub1', name: 'shared.txt', size: 100, type: 'text/plain', uploadedAt: Date.now(),
            visibility: 'public' as const, ownerId: 'did:key:z123', ownerName: 'Alice'
        }];
        render(<FileGrid files={file} onDelete={() => { }} onPreview={() => { }} />);
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Uploader')).toBeInTheDocument();
    });

    it('should display anonymous indicator for public files without owner', () => {
        const file = [{
            id: 'pub2', name: 'anon.txt', size: 100, type: 'text/plain', uploadedAt: Date.now(),
            visibility: 'public' as const
        }];
        render(<FileGrid files={file} onDelete={() => { }} onPreview={() => { }} />);
        expect(screen.getByText('Anonymous upload')).toBeInTheDocument();
    });
});

