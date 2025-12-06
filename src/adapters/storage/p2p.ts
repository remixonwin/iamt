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

// Self-hosted tracker URL (configurable via environment)
const SELF_HOSTED_TRACKER = typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_TRACKER_URL || '')
    : '';

// Build tracker list with self-hosted tracker prioritized if available
function getTrackerList(): string[] {
    const trackers = [
        'wss://tracker.openwebtorrent.com',
        'wss://tracker.btorrent.xyz',
        'wss://tracker.webtorrent.dev',
        'wss://tracker.files.fm:7073/announce',
    ];

    // Prioritize self-hosted tracker if configured
    if (SELF_HOSTED_TRACKER) {
        trackers.unshift(SELF_HOSTED_TRACKER);
    }

    return trackers;
}

export const getP2PClient = async (): Promise<Instance | null> => {
    if (typeof window === 'undefined') return null;

    if (!client) {
        const WebTorrent = await loadWebTorrent();
        if (!WebTorrent) return null;

        const trackerList = getTrackerList();
        console.log('[WebTorrent] Using trackers:', trackerList);

        // @ts-ignore
        client = new WebTorrent({
            dht: true, // Enable DHT for tracker-less peer discovery
            tracker: {
                announce: trackerList
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

    const trackerList = getTrackerList();

    return new Promise((resolve, reject) => {
        // Check if already seeding
        const existing = client.torrents.find(t => t.name === file.name);
        if (existing) {
            console.log('[P2P] Already seeding:', existing.infoHash);
            return resolve(existing.magnetURI);
        }

        client.seed(file, {
            announce: trackerList
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

    // Extract infoHash/CID from magnetURI for lookup
    // Format: magnet:?xt=urn:btih:<hash>&...
    let cid: string | null = null;
    const match = magnetURI.match(/btih:([a-fA-F0-9]+)/);
    if (match) {
        cid = match[1].toLowerCase();
    }

    return new Promise((resolve, reject) => {
        // Helper to get blob from torrent file using modern API
        const getBlobFromFile = async (file: unknown): Promise<Blob> => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const f = file as any;
            try {
                // Try modern arrayBuffer() method first (WebTorrent 1.x+)
                if (typeof f.arrayBuffer === 'function') {
                    const buffer = await f.arrayBuffer();
                    return new Blob([buffer]);
                }
                // Try streaming approach
                if (typeof f.stream === 'function') {
                    const chunks: BlobPart[] = [];
                    const reader = f.stream().getReader();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(new Uint8Array(value) as unknown as BlobPart);
                    }
                    return new Blob(chunks);
                }
                // Fallback to callback-based getBlob if available
                if (typeof f.getBlob === 'function') {
                    return new Promise((res, rej) => {
                        f.getBlob((err: Error | null, blob: Blob | null) => {
                            if (err || !blob) rej(err || new Error('Failed to get blob'));
                            else res(blob);
                        });
                    });
                }
                throw new Error('No compatible method to extract file data');
            } catch (e) {
                throw new Error(`Blob extraction failed: ${e instanceof Error ? e.message : String(e)}`);
            }
        };

        // Check if we already have it
        // client.get() is reliable for finding by infoHash
        let torrent = cid ? client.get(cid) : null;

        // If not found by ID, try to add it
        if (!torrent) {
            try {
                torrent = client.add(magnetURI, {
                    announce: [
                        'wss://tracker.openwebtorrent.com',
                        'wss://tracker.btorrent.xyz',
                        'wss://tracker.webtorrent.dev', // Added redundant tracker
                    ]
                });
            } catch (err) {
                // If add failed because it exists (race condition), try getting it again
                if (cid && (err instanceof Error && err.message.includes('already being seeded'))) {
                    torrent = client.get(cid);
                    if (!torrent) {
                        // Should not happen, but reject if we can't recover
                        reject(err);
                        return;
                    }
                } else {
                    reject(err);
                    return;
                }
            }
        }

        // Define cleanup and handlers
        let timeoutId: NodeJS.Timeout;

        const cleanup = () => {
            clearTimeout(timeoutId);
            if (torrent) {
                torrent.removeListener('done', onDone);
                torrent.removeListener('error', onError);
            }
        };

        const onDone = async () => {
            cleanup();
            console.log('[P2P] Download complete:', torrent?.infoHash);
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const file = (torrent as any).files[0];
                if (!file) throw new Error('Torrent contains no files');
                const blob = await getBlobFromFile(file);
                resolve(blob);
            } catch (err) {
                reject(err);
            }
        };

        const onError = (err: Error) => {
            cleanup();
            reject(err);
        };

        // If already done, resolve immediately
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((torrent as any).progress === 1) {
            onDone();
            return;
        }

        // Attach listeners
        torrent.on('done', onDone);
        torrent.on('error', onError);

        // Timeout 15s
        timeoutId = setTimeout(() => {
            cleanup();
            if ((torrent as any).progress < 1) {
                // We don't destroy the torrent, just stop waiting for it
                reject(new Error('P2P Download timeout'));
            }
        }, 15000);
    });
};
