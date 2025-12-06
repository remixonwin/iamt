import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KuboStorageAdapter } from '@/adapters/storage/kubo';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('KuboStorageAdapter', () => {
    let adapter: KuboStorageAdapter;
    const apiUrl = 'http://localhost:5001';
    const gatewayUrl = 'http://localhost:8080';

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new KuboStorageAdapter(apiUrl, gatewayUrl);
    });

    describe('upload', () => {
        it('should upload file to IPFS via Kubo API', async () => {
            const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
            const expectedCid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

            mockFetch.mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify({ Hash: expectedCid, Name: 'test.txt', Size: '12' })
            });

            const result = await adapter.upload(file);

            expect(mockFetch).toHaveBeenCalledWith(
                `${apiUrl}/api/v0/add?pin=true&cid-version=1`,
                expect.objectContaining({ method: 'POST' })
            );
            expect(result.cid).toBe(expectedCid);
            expect(result.url).toBe(`${gatewayUrl}/ipfs/${expectedCid}`);
            expect(result.visibility).toBe('public');
        });

        it('should throw error on upload failure', async () => {
            const file = new File(['test'], 'test.txt', { type: 'text/plain' });

            mockFetch.mockResolvedValue({
                ok: false,
                text: async () => 'connection refused'
            });

            await expect(adapter.upload(file)).rejects.toThrow('Kubo upload failed');
        });
    });

    describe('download', () => {
        it('should download file from local gateway', async () => {
            const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
            const mockBlob = new Blob(['test content']);

            mockFetch.mockResolvedValue({
                ok: true,
                blob: async () => mockBlob
            });

            const result = await adapter.download(cid);

            expect(mockFetch).toHaveBeenCalledWith(`${gatewayUrl}/ipfs/${cid}`);
            expect(result).toBe(mockBlob);
        });

        it('should fallback to public gateways on local failure', async () => {
            const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
            const mockBlob = new Blob(['test content']);

            // First call (local gateway) fails
            mockFetch.mockResolvedValueOnce({ ok: false });
            // Second call (dweb.link) succeeds
            mockFetch.mockResolvedValueOnce({
                ok: true,
                blob: async () => mockBlob
            });

            const result = await adapter.download(cid);

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(result).toBe(mockBlob);
        });

        it('should throw error when all gateways fail', async () => {
            const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

            // All gateways fail
            mockFetch.mockResolvedValue({ ok: false });

            await expect(adapter.download(cid)).rejects.toThrow(`Failed to download from IPFS: ${cid}`);
        });
    });

    describe('delete', () => {
        it('should unpin file from Kubo', async () => {
            const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

            mockFetch.mockResolvedValue({ ok: true });

            await adapter.delete(cid);

            expect(mockFetch).toHaveBeenCalledWith(
                `${apiUrl}/api/v0/pin/rm?arg=${cid}`,
                { method: 'POST' }
            );
        });

        it('should ignore "not pinned" errors', async () => {
            const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

            mockFetch.mockResolvedValue({
                ok: false,
                text: async () => 'not pinned or pinned indirectly'
            });

            // Should not throw
            await expect(adapter.delete(cid)).resolves.toBeUndefined();
        });
    });

    describe('exists', () => {
        it('should return true if pinned locally', async () => {
            const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ Keys: { [cid]: { Type: 'recursive' } } })
            });

            const result = await adapter.exists(cid);

            expect(result).toBe(true);
        });

        it('should check gateway if not pinned locally', async () => {
            const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

            // First call (pin/ls) returns empty
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ Keys: {} })
            });
            // Second call (gateway HEAD) succeeds
            mockFetch.mockResolvedValueOnce({ ok: true });

            const result = await adapter.exists(cid);

            expect(result).toBe(true);
        });

        it('should return false when file does not exist', async () => {
            const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

            // pin/ls fails
            mockFetch.mockResolvedValueOnce({ ok: false });
            // Gateway HEAD fails
            mockFetch.mockResolvedValueOnce({ ok: false });

            const result = await adapter.exists(cid);

            expect(result).toBe(false);
        });
    });

    describe('pin', () => {
        it('should pin existing CID', async () => {
            const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

            mockFetch.mockResolvedValue({ ok: true });

            await adapter.pin(cid);

            expect(mockFetch).toHaveBeenCalledWith(
                `${apiUrl}/api/v0/pin/add?arg=${cid}`,
                { method: 'POST' }
            );
        });
    });

    describe('getNodeInfo', () => {
        it('should return node information', async () => {
            const mockId = {
                ID: 'QmPeerId123',
                AgentVersion: 'kubo/0.22.0'
            };
            const mockPeers = {
                Peers: [{ Peer: 'peer1' }, { Peer: 'peer2' }]
            };

            mockFetch
                .mockResolvedValueOnce({ ok: true, json: async () => mockId })
                .mockResolvedValueOnce({ ok: true, json: async () => mockPeers });

            const result = await adapter.getNodeInfo();

            expect(result.id).toBe(mockId.ID);
            expect(result.agentVersion).toBe(mockId.AgentVersion);
            expect(result.peers).toBe(2);
        });
    });
});
