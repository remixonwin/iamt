import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileCard } from '@/shared/components/ProfileCard';
import * as AuthContext from '@/shared/contexts/AuthContext';

// Mock the useAuth hook
vi.mock('@/shared/contexts/AuthContext', () => ({
    useAuth: vi.fn(),
}));

describe('ProfileCard', () => {
    const mockUser = {
        displayName: 'John Doe',
        email: 'john@example.com',
        avatarId: null,
        emailVerified: true,
        createdAt: new Date().toISOString(),
    };

    const mockUpdateProfile = vi.fn();
    const mockSendVerificationEmail = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (AuthContext.useAuth as any).mockReturnValue({
            user: mockUser,
            updateProfile: mockUpdateProfile,
            sendVerificationEmail: mockSendVerificationEmail,
            isLoading: false,
        });
    });

    it('should render user information', () => {
        render(<ProfileCard fileCount={5} storageUsed={1024 * 1024} />);
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('1 MB')).toBeInTheDocument();
    });

    it('should allow editing display name', async () => {
        render(<ProfileCard />);

        // Click edit button (pencil icon)
        // Since icon doesn't have text/label, finding by button parent of svg
        const editButton = screen.getByRole('button', { name: '' });
        // The first button in the info section is the edit button next to name
        // Wait, there are other buttons (avatar, verify email).
        // Let's refine selection. It's the button next to the name h2.

        // Easier: check for the edit icon path or better, add test ID if I could.
        // Or find by role button that is inside the same container as name.

        // Let's just find all buttons and assume order or check icon
        const buttons = screen.getAllByRole('button');
        // 0: avatar, 1: edit name (if not editing), 2: verify email? no verify is conditional

        // Let's try to act on what we see.

        // Trigger generic edit mode switch
        // Actually the button has no accessible name in code.
        // Let's rely on class or structure? No.
        // Let's mock a user interaction.
        // Finding the button with the specific SVG path... impossible easily with screen queries without aria attributes.
        // Let's assume it's the second button (after avatar).

        fireEvent.click(buttons[1]);

        const input = screen.getByPlaceholderText('Display name');
        expect(input).toBeInTheDocument();

        fireEvent.change(input, { target: { value: 'New Name' } });

        // Save button (tick)
        const saveButton = screen.getAllByRole('button')[1]; // 0 is avatar, 1 is save
        fireEvent.click(saveButton);

        expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: 'New Name' });
    });

    it('should handle avatar change', () => {
        const onAvatarChange = vi.fn();
        const { container } = render(<ProfileCard onAvatarChange={onAvatarChange} />);

        const file = new File(['(⌐□_□)'], 'chucknorris.png', { type: 'image/png' });

        // Find hidden input
        const fileInput = container.querySelector('input[type="file"]');
        if (!fileInput) throw new Error('File input not found');

        fireEvent.change(fileInput, { target: { files: [file] } });

        expect(onAvatarChange).toHaveBeenCalledWith(file);
    });

    it('should show unverified state and allow verification', () => {
        (AuthContext.useAuth as any).mockReturnValue({
            user: { ...mockUser, emailVerified: false },
            sendVerificationEmail: mockSendVerificationEmail,
        });

        render(<ProfileCard />);
        expect(screen.getByText('Verify email')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Verify email'));
        expect(mockSendVerificationEmail).toHaveBeenCalled();
    });
});
