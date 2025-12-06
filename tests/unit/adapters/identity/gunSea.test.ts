import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publicKeyToDid, generateSeedPhrase, validateSeedPhrase } from '@/adapters/identity/gunSea';

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
