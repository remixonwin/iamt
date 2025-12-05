import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
    isCryptoSupported,
    generateIV,
    generateEncryptionKey,
    exportKey,
    importKey,
    encryptFile,
    decryptFile,
    encryptFileWithPassword,
    decryptFileWithPassword,
    hashFile
} from '@/shared/utils/crypto';

// Polyfill crypto if needed (jsdom might have crypto but not subtle)
import { webcrypto } from 'node:crypto';

if (!global.crypto || !global.crypto.subtle) {
    vi.stubGlobal('crypto', webcrypto);
}

describe('Crypto Utility', () => {
    it('isCryptoSupported should return true in test env', () => {
        expect(isCryptoSupported()).toBe(true);
    });

    it('generateIV should return 12 bytes', () => {
        const iv = generateIV();
        expect(iv).toBeInstanceOf(Uint8Array);
        expect(iv.length).toBe(12);
    });

    describe('Key Management', () => {
        it('should generate, export, and import a key', async () => {
            const key = await generateEncryptionKey();
            expect(key.algorithm.name).toBe('AES-GCM');
            expect((key.algorithm as any).length).toBe(256);

            const exported = await exportKey(key);
            expect(typeof exported).toBe('string');

            const imported = await importKey(exported);
            expect(imported.algorithm.name).toBe(key.algorithm.name);
        });
    });

    describe('Encryption/Decryption', () => {
        it('should encrypt and decrypt a file successfully', async () => {
            const content = 'Hello World Secret';
            const file = new File([content], 'secret.txt', { type: 'text/plain' });

            const result = await encryptFile(file);
            expect(result.encryptedBlob).toBeInstanceOf(Blob);
            expect(result.iv).toBeInstanceOf(Uint8Array);
            expect(result.key).toBeDefined();

            const decrypted = await decryptFile({
                encryptedBlob: result.encryptedBlob,
                exportedKey: result.exportedKey,
                iv: Buffer.from(result.iv).toString('base64')
            }, 'text/plain');

            expect(decrypted).toBeInstanceOf(Blob);
            expect(await decrypted.text()).toBe(content);
        });

        it('should encrypt and decrypt with password', async () => {
            const content = 'Password Sensitive Data';
            const file = new File([content], 'pass.txt', { type: 'text/plain' });
            const password = 'secure-password';

            const result = await encryptFileWithPassword(file, password);
            expect(result.encryptedBlob).toBeInstanceOf(Blob);
            expect(result.salt).toBeDefined();
            expect(result.iv).toBeDefined();

            const decrypted = await decryptFileWithPassword(
                result.encryptedBlob,
                password,
                result.salt,
                result.iv,
                'text/plain'
            );

            expect(decrypted).toBeInstanceOf(Blob);
            expect(await decrypted.text()).toBe(content);
        });
    });

    describe('Hashing', () => {
        it('should hash a file', async () => {
            const file = new File(['content'], 'hash.txt', { type: 'text/plain' });
            const hash = await hashFile(file);
            expect(typeof hash).toBe('string');
            expect(hash.length).toBeGreaterThan(0);
        });
    });
});

