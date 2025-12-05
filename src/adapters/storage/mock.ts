import type { StorageAdapter, UploadResult } from './types';

/**
 * Mock Storage Adapter for testing
 * 
 * Stores files in memory. Use this adapter in tests to avoid
 * hitting real IPFS/Arweave services.
 * 
 * @example
 * ```typescript
 * const storage = new MockStorageAdapter();
 * const { cid } = await storage.upload(file);
 * expect(cid).toBeDefined();
 * ```
 */
export class MockStorageAdapter implements StorageAdapter {
    private store = new Map<string, { file: File; metadata: UploadResult }>();

    async upload(file: File): Promise<UploadResult> {
        const cid = `mock-cid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const result: UploadResult = {
            cid,
            url: `https://mock.storage/${cid}`,
            size: file.size,
        };

        this.store.set(cid, { file, metadata: result });
        return result;
    }

    async download(cid: string): Promise<Blob> {
        const entry = this.store.get(cid);
        if (!entry) {
            throw new Error(`File not found: ${cid}`);
        }
        // Return the stored file (File extends Blob)
        return entry.file;
    }

    async delete(cid: string): Promise<void> {
        if (!this.store.has(cid)) {
            throw new Error(`File not found: ${cid}`);
        }
        this.store.delete(cid);
    }

    async exists(cid: string): Promise<boolean> {
        return this.store.has(cid);
    }

    /** Clear all stored files (useful between tests) */
    clear(): void {
        this.store.clear();
    }
}


