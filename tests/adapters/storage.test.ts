import { describe, it, expect, beforeEach } from 'vitest';
import { MockStorageAdapter } from '@/adapters';

describe('StorageAdapter', () => {
    let storage: MockStorageAdapter;

    beforeEach(() => {
        storage = new MockStorageAdapter();
        storage.clear();
    });

    describe('upload', () => {
        it('should return a CID and URL after upload', async () => {
            const file = new File(['hello world'], 'test.txt', { type: 'text/plain' });

            const result = await storage.upload(file);

            expect(result.cid).toBeDefined();
            expect(result.cid).toContain('mock-cid-');
            expect(result.url).toContain(result.cid);
            expect(result.size).toBe(file.size);
        });

        it('should generate unique CIDs for different uploads', async () => {
            const file1 = new File(['file1'], 'test1.txt');
            const file2 = new File(['file2'], 'test2.txt');

            const result1 = await storage.upload(file1);
            const result2 = await storage.upload(file2);

            expect(result1.cid).not.toBe(result2.cid);
        });
    });

    describe('download', () => {
        it('should retrieve uploaded file by CID', async () => {
            const content = 'test content';
            const file = new File([content], 'test.txt', { type: 'text/plain' });
            const { cid } = await storage.upload(file);

            const downloaded = await storage.download(cid);

            // Verify the blob is returned (jsdom has limited Blob API)
            expect(downloaded).toBeDefined();
            expect(downloaded.size).toBe(file.size);
            expect(downloaded.type).toBe('text/plain');
        });

        it('should throw error for non-existent CID', async () => {
            await expect(storage.download('non-existent-cid')).rejects.toThrow('File not found');
        });
    });

    describe('exists', () => {
        it('should return true for existing file', async () => {
            const file = new File(['test'], 'test.txt');
            const { cid } = await storage.upload(file);

            expect(await storage.exists(cid)).toBe(true);
        });

        it('should return false for non-existent file', async () => {
            expect(await storage.exists('fake-cid')).toBe(false);
        });
    });

    describe('delete', () => {
        it('should remove file from storage', async () => {
            const file = new File(['test'], 'test.txt');
            const { cid } = await storage.upload(file);

            await storage.delete(cid);

            expect(await storage.exists(cid)).toBe(false);
        });

        it('should throw error when deleting non-existent file', async () => {
            await expect(storage.delete('fake-cid')).rejects.toThrow('File not found');
        });
    });
});
