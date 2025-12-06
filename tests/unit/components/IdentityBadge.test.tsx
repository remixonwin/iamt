import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IdentityBadge } from '@/shared/components/IdentityBadge';

describe('IdentityBadge', () => {
    const mockDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';

    beforeEach(() => {
        // Mock clipboard API
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockImplementation(() => Promise.resolve()),
            },
        });
    });

    it('should render truncated DID', () => {
        render(<IdentityBadge did={mockDid} emailVerified={false} />);
        // First 12 chars: did:key:z6Mk
        // Last 8 chars: Gta2doK
        expect(screen.getByText(/did:key:z6Mk/)).toBeInTheDocument();
        expect(screen.getByText(/Gta2doK/)).toBeInTheDocument();
    });

    it('should show verified badge when emailVerified is true', () => {
        render(<IdentityBadge did={mockDid} emailVerified={true} />);
        expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('should show unverified badge when emailVerified is false', () => {
        render(<IdentityBadge did={mockDid} emailVerified={false} />);
        expect(screen.getByText('Unverified')).toBeInTheDocument();
    });

    it('should render compact mode correctly', () => {
        render(<IdentityBadge did={mockDid} emailVerified={true} compact={true} />);
        // Compact mode usually just shows the truncated DID code and verification icon
        // It does not show "Decentralized Identity" title
        expect(screen.queryByText('Decentralized Identity')).not.toBeInTheDocument();
        expect(screen.getByTitle('Email Verified')).toBeInTheDocument();
    });

    it('should copy DID to clipboard on click', async () => {
        render(<IdentityBadge did={mockDid} emailVerified={false} />);
        const copyButton = screen.getByTitle('Copy full DID');

        fireEvent.click(copyButton);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockDid);

        // Should show success icon (maybe implicit, but we can check if button content changes if we knew the change)
        // The component sets 'copied' state which changes the icon.
    });
});
