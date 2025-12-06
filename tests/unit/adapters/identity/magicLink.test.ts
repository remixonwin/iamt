import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateToken, buildMagicLinkUrl } from '@/adapters/identity/magicLink';

describe('Magic Link Token Management', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateToken', () => {
        it('should generate a non-empty string token', () => {
            const token = generateToken();
            
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.length).toBeGreaterThan(0);
        });

        it('should generate unique tokens', () => {
            const token1 = generateToken();
            const token2 = generateToken();
            
            expect(token1).not.toBe(token2);
        });
    });

    describe('buildMagicLinkUrl', () => {
        it('should build verification URL', () => {
            const url = buildMagicLinkUrl('test-token', 'verification');
            
            expect(url).toContain('/auth/verify');
            expect(url).toContain('token=test-token');
            expect(url).toContain('type=verification');
        });

        it('should build recovery URL', () => {
            const url = buildMagicLinkUrl('recovery-token', 'recovery');
            
            expect(url).toContain('/auth/verify');
            expect(url).toContain('token=recovery-token');
            expect(url).toContain('type=recovery');
        });
    });
});
