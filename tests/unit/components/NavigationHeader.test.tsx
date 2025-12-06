import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NavigationHeader } from '@/shared/components/NavigationHeader';
import * as AuthContext from '@/shared/contexts/AuthContext';

// Mock the useAuth hook
vi.mock('@/shared/contexts/AuthContext', () => ({
    useAuth: vi.fn(),
}));

describe('NavigationHeader', () => {
    it('should show login/signup links when not authenticated', () => {
        (AuthContext.useAuth as any).mockReturnValue({
            isAuthenticated: false,
            isLoading: false,
            user: null,
        });

        render(<NavigationHeader />);
        expect(screen.getByText('Login')).toBeInTheDocument();
        expect(screen.getByText('Sign Up')).toBeInTheDocument();
        expect(screen.queryByText('Profile')).not.toBeInTheDocument();
    });

    it('should show profile link and avatar when authenticated', () => {
        (AuthContext.useAuth as any).mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            user: { displayName: 'John Doe', email: 'john@example.com' },
        });

        render(<NavigationHeader />);
        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByText('J')).toBeInTheDocument(); // J from John
        expect(screen.queryByText('Login')).not.toBeInTheDocument();
    });

    it('should show loading state', () => {
        (AuthContext.useAuth as any).mockReturnValue({
            isAuthenticated: false,
            isLoading: true,
            user: null,
        });

        const { container } = render(<NavigationHeader />);
        // Look for the pulse animation div
        expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('should display fallback avatar if no display name', () => {
        (AuthContext.useAuth as any).mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            user: { displayName: '', email: 'alice@example.com' },
        });

        render(<NavigationHeader />);
        expect(screen.getByText('A')).toBeInTheDocument(); // A from Alice
    });
});
