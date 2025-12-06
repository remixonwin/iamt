/**
 * Magic Link Module
 * 
 * Handles email verification and password recovery via magic links.
 * Tokens are stored in Gun.js with 15-minute expiration.
 */

'use client';

import type { MagicLinkToken } from './types';
import { getGunSeaAdapter } from './gunSea';

// Token expiration time (15 minutes)
const TOKEN_EXPIRY_MS = 15 * 60 * 1000;

// Gun.js namespace for magic links
const MAGIC_LINK_NAMESPACE = 'iamt-magic-links';

/**
 * Generate a secure random token
 */
export function generateToken(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Create a magic link token for email verification
 */
export async function createVerificationToken(email: string): Promise<MagicLinkToken> {
    const token: MagicLinkToken = {
        token: generateToken(),
        email,
        createdAt: Date.now(),
        expiresAt: Date.now() + TOKEN_EXPIRY_MS,
        used: false,
        type: 'verification',
    };

    await storeToken(token);
    return token;
}

/**
 * Create a magic link token for password recovery
 */
export async function createRecoveryToken(email: string): Promise<MagicLinkToken> {
    const token: MagicLinkToken = {
        token: generateToken(),
        email,
        createdAt: Date.now(),
        expiresAt: Date.now() + TOKEN_EXPIRY_MS,
        used: false,
        type: 'recovery',
    };

    await storeToken(token);
    return token;
}

/**
 * Store token in Gun.js
 */
async function storeToken(token: MagicLinkToken): Promise<void> {
    const adapter = getGunSeaAdapter();
    const gun = adapter.getGun();

    if (!gun) {
        throw new Error('Gun.js not initialized');
    }

    return new Promise((resolve, reject) => {
        gun.get(MAGIC_LINK_NAMESPACE)
            .get(token.token)
            .put(token, (ack: { err?: string }) => {
                if (ack.err) {
                    reject(new Error(ack.err));
                } else {
                    resolve();
                }
            });
    });
}

/**
 * Retrieve and validate a magic link token
 */
export async function validateToken(tokenId: string): Promise<MagicLinkToken | null> {
    const adapter = getGunSeaAdapter();
    const gun = adapter.getGun();

    if (!gun) {
        return null;
    }

    return new Promise((resolve) => {
        gun.get(MAGIC_LINK_NAMESPACE)
            .get(tokenId)
            .once((token: MagicLinkToken | null) => {
                if (!token) {
                    resolve(null);
                    return;
                }

                // Check if expired
                if (Date.now() > token.expiresAt) {
                    resolve(null);
                    return;
                }

                // Check if already used
                if (token.used) {
                    resolve(null);
                    return;
                }

                resolve(token);
            });
    });
}

/**
 * Mark a token as used
 */
export async function markTokenUsed(tokenId: string): Promise<void> {
    const adapter = getGunSeaAdapter();
    const gun = adapter.getGun();

    if (!gun) {
        throw new Error('Gun.js not initialized');
    }

    return new Promise((resolve, reject) => {
        gun.get(MAGIC_LINK_NAMESPACE)
            .get(tokenId)
            .get('used')
            .put(true, (ack: { err?: string }) => {
                if (ack.err) {
                    reject(new Error(ack.err));
                } else {
                    resolve();
                }
            });
    });
}

/**
 * Verify a magic link token and perform the associated action
 */
export async function verifyMagicLink(tokenId: string): Promise<{ success: boolean; email?: string; type?: 'verification' | 'recovery' }> {
    const token = await validateToken(tokenId);

    if (!token) {
        return { success: false };
    }

    // Mark as used
    await markTokenUsed(tokenId);

    // If verification token, mark email as verified
    if (token.type === 'verification') {
        const adapter = getGunSeaAdapter();
        if (adapter.isAuthenticated()) {
            await adapter.markEmailVerified();
        }
    }

    return {
        success: true,
        email: token.email,
        type: token.type,
    };
}

/**
 * Build magic link URL
 */
export function buildMagicLinkUrl(token: string, type: 'verification' | 'recovery'): string {
    if (typeof window === 'undefined') {
        return `/auth/verify?token=${token}&type=${type}`;
    }
    
    const baseUrl = window.location.origin;
    return `${baseUrl}/auth/verify?token=${token}&type=${type}`;
}

/**
 * Delete expired tokens (cleanup)
 */
export async function cleanupExpiredTokens(): Promise<void> {
    // Gun.js doesn't have a built-in way to query by expiration
    // In production, you'd run this periodically server-side
    // For now, tokens are validated on read
    console.log('[MagicLink] Token cleanup not implemented - tokens expire on read');
}
