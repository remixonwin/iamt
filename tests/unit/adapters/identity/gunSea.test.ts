import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publicKeyToDid, generateSeedPhrase, validateSeedPhrase } from '@/adapters/identity/gunSea';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Gun = require('gun');

// Mock bip39 module
vi.mock('bip39', () => ({
    generateMnemonic: vi.fn(() => 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'),
    validateMnemonic: vi.fn((phrase: string) => phrase.split(' ').length === 12),
    mnemonicToSeed: vi.fn(() => Promise.resolve(new Uint8Array(64).fill(1))),
}));

// Mock bs58 module
vi.mock('bs58', () => ({
    default: {
        encode: vi.fn((bytes: Uint8Array) => 'z' + Buffer.from(bytes).toString('base64').slice(0, 32)),
    },
}));

describe('GunSEA Identity Adapter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should attempt one-time recovery on corrupted auth error', async () => {
        const adapterModule = await import('@/adapters/identity/gunSea');
        const { GunSeaAdapter } = adapterModule as unknown as { GunSeaAdapter: new () => any };

        const adapter = new GunSeaAdapter();

        // Mock gun and user.auth
        const authMock = vi.fn()
            // First call: simulate corruption error from Gun
            .mockImplementationOnce((_alias: string, _pass: string, cb: (ack: { err?: string }) => void) => {
                cb({ err: 'Invalid data: Number at ~some.path' });
            })
            // Second call (after cleanup): succeed
            .mockImplementationOnce((_alias: string, _pass: string, cb: (ack: { err?: string }) => void) => {
                cb({});
            });

        (adapter as any).user = { auth: authMock };
        (adapter as any).gun = new Gun({ localStorage: false });

        // Spy on clearLocalGunData to ensure it is called
        const clearSpy = vi.spyOn(adapter as any, 'clearLocalGunData');

        await adapter['authenticateInternal']('test@example.com', 'password123');

        expect(authMock).toHaveBeenCalledTimes(2);
        expect(clearSpy).toHaveBeenCalledTimes(1);
    });

    describe('publicKeyToDid', () => {
        it('should convert public key to did:key format', () => {
            const publicKey = btoa('test-public-key');
            const did = publicKeyToDid(publicKey);
            
            expect(did).toMatch(/^did:key:z/);
        });

        it('should handle empty public key gracefully', () => {
            const did = publicKeyToDid('');
            expect(did).toMatch(/^did:key:z/);
        });
    });

    describe('generateSeedPhrase', () => {
        it('should generate a 12-word seed phrase', () => {
            const phrase = generateSeedPhrase();
            const words = phrase.split(' ');
            
            expect(words).toHaveLength(12);
        });
    });

    describe('validateSeedPhrase', () => {
        it('should return true for valid 12-word phrase', () => {
            const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            expect(validateSeedPhrase(phrase)).toBe(true);
        });

        it('should return false for invalid phrase', () => {
            const phrase = 'not enough words';
            expect(validateSeedPhrase(phrase)).toBe(false);
        });
    });
});
