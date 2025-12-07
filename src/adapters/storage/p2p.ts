import type { Instance } from 'webtorrent';
import { logger, LogCategory } from '@/shared/utils/logger';
import { SYNC_CONFIG } from '@/shared/config';

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
        logger.error(LogCategory.P2P, 'Failed to load WebTorrent', err);
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
        logger.info(LogCategory.P2P, 'Using trackers', trackerList);

        // @ts-ignore
        client = new WebTorrent({
            dht: true, // Enable DHT for tracker-less peer discovery
            tracker: {
                announce: trackerList
            }
        });

        client.on('error', (err) => {
            logger.error(LogCategory.P2P, 'Client error', err);
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
            logger.debug(LogCategory.P2P, 'Already seeding', existing.infoHash);
            return resolve(existing.magnetURI);
        }

        client.seed(file, {
            announce: trackerList
        }, (torrent) => {
            logger.info(LogCategory.P2P, 'Seeding', torrent.infoHash);
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

    return new Promise(async (resolve, reject) => {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let torrent: any = cid ? client.get(cid) : null;

        // If not found by ID, try to add it
        if (!torrent) {
            try {
                torrent = client.add(magnetURI, {
                    announce: [
                        'wss://tracker.openwebtorrent.com',
                        'wss://tracker.btorrent.xyz',
                        'wss://tracker.webtorrent.dev',
                    ]
                });
            } catch (err) {
                // If add failed because it exists (race condition), try getting it again
                if (cid && (err instanceof Error && err.message.includes('already being seeded'))) {
                    torrent = client.get(cid);
                    if (!torrent) {
                        reject(err);
                        return;
                    }
                } else {
                    reject(err);
                    return;
                }
            }
        }

        // Validate torrent object
        if (!torrent) {
            reject(new Error('Failed to create torrent'));
            return;
        }

        // Define cleanup and handlers
        let timeoutId: NodeJS.Timeout;
        let cleaned = false;

        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            clearTimeout(timeoutId);
            try {
                if (torrent && typeof torrent.removeListener === 'function') {
                    torrent.removeListener('done', onDone);
                    torrent.removeListener('error', onError);
                }
            } catch {
                // Ignore cleanup errors
            }
        };

        const onDone = async () => {
            cleanup();
            logger.info(LogCategory.P2P, 'Download complete', torrent?.infoHash);
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const file = (torrent as any).files?.[0];
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
        if ((torrent as any).progress === 1 && (torrent as any).files?.length > 0) {
            onDone();
            return;
        }

        // Attach listeners - handle case where torrent is still initializing
        if (torrent && typeof torrent.on === 'function') {
            torrent.on('done', onDone);
            torrent.on('error', onError);
        } else if (torrent && typeof torrent.once === 'function') {
            // Try once() method
            torrent.once('done', onDone);
            torrent.once('error', onError);
        } else {
            // Torrent object may not be ready yet - wait a moment and retry
            logger.warn(LogCategory.P2P, 'Torrent not ready, waiting...', { hasOn: typeof torrent?.on });
            await new Promise(r => setTimeout(r, 500));

            if (torrent && typeof torrent.on === 'function') {
                torrent.on('done', onDone);
                torrent.on('error', onError);
            } else {
                reject(new Error('Invalid torrent object - initialization failed'));
                return;
            }
        }

        // Timeout using config
        timeoutId = setTimeout(() => {
            cleanup();
            const progress = (torrent as any)?.progress ?? 0;
            if (progress < 1) {
                logger.warn(LogCategory.P2P, 'Download timeout', { progress });
                reject(new Error('P2P Download timeout'));
            }
        }, SYNC_CONFIG.p2p.downloadTimeout);
    });
};

