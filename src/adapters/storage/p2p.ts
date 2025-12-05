import type { Instance } from 'webtorrent';

let client: Instance | null = null;
let WebTorrentModule: typeof import('webtorrent') | null = null;

/**
 * Dynamically load WebTorrent only in browser
 */
async function loadWebTorrent(): Promise<typeof import('webtorrent') | null> {
    if (typeof window === 'undefined') return null;
    if (WebTorrentModule) return WebTorrentModule;
    
    try {
        // Dynamic import to avoid SSR issues
        // @ts-ignore
        WebTorrentModule = (await import('webtorrent')).default;
        return WebTorrentModule;
    } catch (err) {
        console.error('[WebTorrent] Failed to load:', err);
        return null;
    }
}

export const getP2PClient = async (): Promise<Instance | null> => {
    if (typeof window === 'undefined') return null;

    if (!client) {
        const WebTorrent = await loadWebTorrent();
        if (!WebTorrent) return null;

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

export const seedFile = async (file: File): Promise<string> => {
    const client = await getP2PClient();
    if (!client) throw new Error('WebTorrent not supported in this environment');

    return new Promise((resolve, reject) => {
        // Check if already seeding
        const existing = client.torrents.find(t => t.name === file.name);
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

export const downloadFileP2P = async (magnetURI: string): Promise<Blob> => {
    const client = await getP2PClient();
    if (!client) throw new Error('WebTorrent not supported');

    return new Promise((resolve, reject) => {
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
                reject(new Error('P2P Download timeout'));
            }
        }, 15000);
    });
};
