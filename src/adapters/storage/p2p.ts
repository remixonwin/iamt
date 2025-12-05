import type { Instance, Torrent } from 'webtorrent';
// @ts-ignore
import WebTorrent from 'webtorrent';

let client: Instance | null = null;

export const getP2PClient = (): Instance | null => {
    if (typeof window === 'undefined') return null;

    if (!client) {
        // @ts-ignore
        client = new WebTorrent({
            tracker: {
                announce: [
                    'wss://tracker.openwebtorrent.com',
                    'wss://tracker.btorrent.xyz',
                ]
            }
        });

        client.on('error', (err) => {
            console.error('[WebTorrent] Client error:', err);
        });
    }

    return client;
};

export const seedFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const client = getP2PClient();
        if (!client) return reject(new Error('WebTorrent not supported in this environment'));

        // Check if already seeding
        const existing = client.torrents.find(t => t.name === file.name); // Simple check
        if (existing) {
            console.log('[P2P] Already seeding:', existing.infoHash);
            return resolve(existing.magnetURI);
        }

        client.seed(file, {
            announce: [
                'wss://tracker.openwebtorrent.com',
                'wss://tracker.btorrent.xyz',
            ]
        }, (torrent) => {
            console.log('[P2P] Seeding:', torrent.infoHash);
            resolve(torrent.magnetURI);
        });

        client.on('error', reject);
    });
};

export const downloadFileP2P = (magnetURI: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const client = getP2PClient();
        if (!client) return reject(new Error('WebTorrent not supported'));

        // Check if we already have it
        const existing = client.get(magnetURI);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (existing && (existing as any).progress === 1) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (existing as any).files[0].getBlob((err: Error | null, blob: Blob | null) => {
                if (err || !blob) reject(err);
                else resolve(blob);
            });
            return;
        }

        const torrent = client.add(magnetURI, {
            announce: [
                'wss://tracker.openwebtorrent.com',
                'wss://tracker.btorrent.xyz',
            ]
        });

        torrent.on('done', () => {
            console.log('[P2P] Download complete:', torrent.infoHash);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (torrent as any).files[0].getBlob((err: Error | null, blob: Blob | null) => {
                if (err || !blob) reject(err);
                else resolve(blob);
            });
        });

        torrent.on('error', reject);

        // Timeout 15s (fallback to HTTP handled by caller)
        setTimeout(() => {
            if (torrent.progress < 1) {
                // Don't destroy, let it continue in background, but reject promise to trigger fallback
                reject(new Error('P2P Download timeout'));
            }
        }, 15000);
    });
};
