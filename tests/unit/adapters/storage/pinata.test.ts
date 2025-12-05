import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PinataStorageAdapter } from '@/adapters/storage/pinata';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('PinataStorageAdapter', () => {
    let adapter: PinataStorageAdapter;
    const jwt = 'test-jwt';

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new PinataStorageAdapter(jwt);
    });

    describe('upload', () => {
        it('should upload file to pinata', async () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });

            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ IpfsHash: 'QmHash' })
            });

            const result = await adapter.upload(file);

            expect(mockFetch).toHaveBeenCalledWith('https://api.pinata.cloud/pinning/pinFileToIPFS', expect.objectContaining({
                method: 'POST',
                headers: { Authorization: `Bearer ${jwt}` },
                body: expect.any(FormData)
            }));
            expect(result.cid).toBe('QmHash');
            expect(result.url).toContain('QmHash');
        });

        it('should throw error on failure', async () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            mockFetch.mockResolvedValue({
                ok: false,
                text: async () => 'Authorization failed'
            });

            await expect(adapter.upload(file)).rejects.toThrow('Pinata upload failed: Authorization failed');
        });
    });

    describe('download', () => {
        it('should download file from gateway', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                blob: async () => new Blob(['content'])
            });

            const blob = await adapter.download('QmHash');
            expect(mockFetch).toHaveBeenCalledWith('https://gateway.pinata.cloud/ipfs/QmHash');
            expect(await blob.text()).toBe('content');
        });

        it('should throw error on download failure', async () => {
            mockFetch.mockResolvedValue({ ok: false });
            await expect(adapter.download('QmHash')).rejects.toThrow('Failed to download');
        });
    });

    describe('delete', () => {
        it('should unpin file', async () => {
            mockFetch.mockResolvedValue({ ok: true });

            await adapter.delete('QmHash');
            expect(mockFetch).toHaveBeenCalledWith('https://api.pinata.cloud/pinning/unpin/QmHash', expect.objectContaining({
                method: 'DELETE'
            }));
        });
    });

    describe('exists', () => {
        it('should return true if head request is ok', async () => {
            mockFetch.mockResolvedValue({ ok: true });
            expect(await adapter.exists('QmHash')).toBe(true);
        });

        it('should return false if head request fails', async () => {
            mockFetch.mockResolvedValue({ ok: false });
            expect(await adapter.exists('QmHash')).toBe(false);
        });
    });
});
