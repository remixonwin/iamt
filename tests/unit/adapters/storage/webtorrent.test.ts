import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebTorrentStorageAdapter } from '@/adapters/storage/webtorrent';
import * as p2p from '@/adapters/storage/p2p';

// Mock dependencies
vi.mock('@/adapters/storage/p2p', () => ({
    seedFile: vi.fn(),
    downloadFileP2P: vi.fn(),
}));

// Mock crypto utilities to avoid crypto.subtle issues in test environment
vi.mock('@/shared/utils/crypto', async (importOriginal) => {
    const actual = await importOriginal() as object;
    return {
        ...actual,
        hashFile: vi.fn().mockResolvedValue('mock-hash-123'),
        computeBlindedHash: vi.fn().mockResolvedValue('mock-blinded-hash-456'),
        isCryptoSupported: vi.fn().mockReturnValue(false), // Disable encryption for basic tests
    };
});

// Mock contentIndex to avoid IndexedDB dependency
vi.mock('@/shared/lib/dedup/contentIndex', () => ({
    getContentIndex: vi.fn().mockReturnValue({
        lookup: vi.fn().mockResolvedValue(null),
        store: vi.fn().mockResolvedValue(undefined),
    }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('WebTorrentStorageAdapter', () => {
    let adapter: WebTorrentStorageAdapter;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new WebTorrentStorageAdapter('http://mock-api');
    });

    describe('upload', () => {
        it('should upload to server and try p2p seeding', async () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });

            // Mock P2P seed success
            vi.mocked(p2p.seedFile).mockResolvedValue('magnet:?xt=test');

            // Mock Server upload success
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ infoHash: 'hash', size: 123, magnetURI: 'magnet:server' })
            });

            const result = await adapter.upload(file);

            expect(p2p.seedFile).toHaveBeenCalledWith(file);
            expect(mockFetch).toHaveBeenCalledWith('http://mock-api/upload', expect.objectContaining({
                method: 'POST',
                body: expect.any(FormData)
            }));

            expect(result.url).toBe('magnet:?xt=test'); // Prefers browser magnet
        });

        it('should fallback to server magnet if p2p fails', async () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });

            // Mock P2P seed failure
            vi.mocked(p2p.seedFile).mockRejectedValue(new Error('P2P fail'));

            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ infoHash: 'hash', size: 123, magnetURI: 'magnet:server' })
            });

            const result = await adapter.upload(file);

            expect(result.url).toBe('magnet:server');
        });
    });

    describe('download', () => {
        it('should try IPFS gateway for Qm... CIDs', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                blob: async () => new Blob(['ipfs-content'])
            });

            const blob = await adapter.download('QmHash');
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('gateway.pinata.cloud'));
            expect(await blob.text()).toBe('ipfs-content');
        });

        it('should try P2P download first', async () => {
            vi.mocked(p2p.downloadFileP2P).mockResolvedValue(new Blob(['p2p-content']));

            const blob = await adapter.download('test-cid');
            expect(p2p.downloadFileP2P).toHaveBeenCalled();
            expect(await blob.text()).toBe('p2p-content');
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should fallback to server download if P2P fails', async () => {
            vi.mocked(p2p.downloadFileP2P).mockRejectedValue(new Error('P2P fail'));

            mockFetch.mockResolvedValue({
                ok: true,
                blob: async () => new Blob(['server-content'])
            });

            const blob = await adapter.download('test-cid');
            expect(mockFetch).toHaveBeenCalledWith('http://mock-api/download/test-cid');
            expect(await blob.text()).toBe('server-content');
        });
    });
});
