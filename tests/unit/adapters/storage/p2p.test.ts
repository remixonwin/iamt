import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// import { getP2PClient, seedFile, downloadFileP2P } from '@/adapters/storage/p2p'; // Using dynamic imports

// Hoist mocks to be available in vi.mock factory
const mocks = vi.hoisted(() => {
    const mockTorrent = {
        infoHash: 'test-hash',
        magnetURI: 'magnet:?xt=urn:btih:test-hash',
        progress: 1,
        files: [{
            getBlob: vi.fn((cb) => cb(null, new Blob(['content']))) // Blob now has polyfill from setup
        }],
        on: vi.fn(),
    };

    const mockClient = {
        torrents: [] as any[],
        seed: vi.fn(),
        add: vi.fn(),
        get: vi.fn(),
        on: vi.fn(),
    };

    return { mockClient, mockTorrent, mockWebTorrent: vi.fn(() => mockClient) };
});

vi.mock('webtorrent', () => ({
    default: mocks.mockWebTorrent
}));

describe('P2P Adapter', () => {
    beforeEach(() => {
        vi.resetModules(); // Reset module state (client singleton)
        vi.clearAllMocks();
        mocks.mockClient.torrents = [];
        mocks.mockClient.seed.mockImplementation((file, opts, cb) => {
            cb(mocks.mockTorrent);
            return mocks.mockTorrent;
        });
        mocks.mockClient.add.mockImplementation((magnet, opts) => {
            return mocks.mockTorrent;
        });
        mocks.mockClient.get.mockReturnValue(null);
    });

    it('should initialize WebTorrent client', async () => {
        const { getP2PClient } = await import('@/adapters/storage/p2p');
        const client = getP2PClient();
        expect(mocks.mockWebTorrent).toHaveBeenCalled();
        expect(client).toBe(mocks.mockClient);
    });

    it('should reuse existing client', async () => {
        const { getP2PClient } = await import('@/adapters/storage/p2p');
        getP2PClient();
        getP2PClient();
        expect(mocks.mockWebTorrent).toHaveBeenCalledTimes(1);
    });

    describe('seedFile', () => {
        it('should seed a file', async () => {
            const { seedFile } = await import('@/adapters/storage/p2p');
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const magnet = await seedFile(file);

            expect(mocks.mockClient.seed).toHaveBeenCalledWith(file, expect.any(Object), expect.any(Function));
            expect(magnet).toBe(mocks.mockTorrent.magnetURI);
        });

        it('should return existing magnet if already seeding', async () => {
            const { seedFile } = await import('@/adapters/storage/p2p');
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            mocks.mockClient.torrents.push({ name: 'test.txt', magnetURI: 'existing-magnet', infoHash: 'hash' });

            const magnet = await seedFile(file);
            expect(magnet).toBe('existing-magnet');
            expect(mocks.mockClient.seed).not.toHaveBeenCalled();
        });
    });

    describe('downloadFileP2P', () => {
        it('should download from existing torrent if complete', async () => {
            const { downloadFileP2P } = await import('@/adapters/storage/p2p');
            mocks.mockClient.get.mockReturnValue({
                progress: 1,
                files: [{ getBlob: vi.fn((cb) => cb(null, new Blob(['content']))) }]
            });

            const blob = await downloadFileP2P('magnet:?xt=urn:btih:test');
            expect(blob).toBeInstanceOf(Blob);
        });

        it('should add torrent and wait for done event', async () => {
            const { downloadFileP2P } = await import('@/adapters/storage/p2p');
            mocks.mockClient.get.mockReturnValue(null);

            mocks.mockTorrent.on.mockImplementation((event, cb) => {
                if (event === 'done') cb();
            });

            const blob = await downloadFileP2P('magnet:?xt=urn:btih:test');
            expect(mocks.mockClient.add).toHaveBeenCalled();
            expect(blob).toBeInstanceOf(Blob);
        });
    });
});
