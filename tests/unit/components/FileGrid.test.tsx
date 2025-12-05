import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileGrid } from '@/shared/components/FileGrid';

// Default mock files
const mockFiles = [
    { id: '1', name: 'test1.txt', size: 1024, type: 'text/plain', uploadedAt: Date.now() },
    { id: '2', name: 'image.png', size: 5000, type: 'image/png', preview: 'blob:img', uploadedAt: Date.now() },
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

        // Find buttons. Since they are hidden until hover, they exist in DOM.
        // The SVG path for delete icon has specific d attribute or we can find by role/class if available.
        // Or better, add aria-label to button in source component. But assuming I can't edit source easily now,
        // I will find button by traversing or adding selector.
        // Actually, let's just use container query or queryAllByRole('button')

        const deleteButtons = screen.getAllByRole('button');
        fireEvent.click(deleteButtons[0]);
        expect(onDelete).toHaveBeenCalledWith('1');
    });
});
