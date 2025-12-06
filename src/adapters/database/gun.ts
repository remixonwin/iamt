/**
 * Gun.js Database Adapter
 * 
 * Connects to local relay in development, public relay in production.
 */

'use client';

// Use environment variable or fallback to localhost for dev
const PRIMARY_RELAY = process.env.NEXT_PUBLIC_GUN_RELAY || 'http://localhost:8765/gun';

// Working public Gun.js relays for production
// Note: Vercel serverless functions don't support WebSockets, so we must use external relays
const PUBLIC_RELAYS: string[] = [
    'https://gun-relay.meething.space/gun',
    'https://peer.wallie.io/gun',
];

// Determine if running in production (not localhost)
const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');

// In production, ALWAYS use public relays (Vercel serverless can't handle WebSockets)
// For local dev, use the configured PRIMARY_RELAY
const RELAYS = isProduction
    ? PUBLIC_RELAYS
    : [PRIMARY_RELAY];

// App namespace
const APP_NAMESPACE = 'iamt-files-v3';

/**
 * File Visibility Options
 */
export type FileVisibility = 'public' | 'private' | 'password-protected';

// Type for file metadata
export interface GunFileMetadata {
    id: string;
    name: string;
    size: number;
    type: string;
    createdAt: number;
    deviceId: string;
    url?: string;

    // Privacy/Security fields
    /** File visibility setting */
    visibility: FileVisibility;
    /** Whether file content is encrypted */
    encrypted: boolean;
    /** Base64 encoded IV for decryption (safe to share) */
    encryptionIv?: string;
    /** Base64 encoded salt for password-derived key */
    encryptionSalt?: string;
    /** Original MIME type (before encryption) */
    originalType?: string;
    /** File hash for integrity verification */
    fileHash?: string;

    // Ownership fields
    /** Owner user ID (DID or public key) */
    ownerId?: string;
}

/**
 * Get or create a unique device ID
 */
function getDeviceId(): string {
    if (typeof window === 'undefined') return 'server';

    let deviceId = localStorage.getItem('iamt-device-id');
    if (!deviceId) {
        deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem('iamt-device-id', deviceId);
    }
    return deviceId;
}

/**
 * Gun.js Database Adapter
 */
export class GunDatabaseAdapter {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private gun: any = null;
    private deviceId: string;
    private initialized = false;

    constructor() {
        this.deviceId = getDeviceId();

        if (typeof window !== 'undefined') {
            this.initGun();
        }
    }

    private async initGun() {
        if (this.initialized) return;
        this.initialized = true;

        const Gun = (await import('gun')).default;

        console.log('[GunSEA] Initializing with relay:', PRIMARY_RELAY);
        console.log('[GunSEA] Public relays:', PUBLIC_RELAYS);
        console.log('[GunSEA] All configured relays:', RELAYS);

        this.gun = Gun({
            peers: RELAYS,
            localStorage: true,
        });

        console.log('[Gun.js] Connecting to:', PRIMARY_RELAY);
        console.log('[Gun.js] LocalStorage enabled:', true);

        // Verify localStorage is accessible
        try {
            const testKey = `gun-test-${Date.now()}`;
            localStorage.setItem(testKey, 'test');
            const retrieved = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);
            console.log('[Gun.js] LocalStorage verified:', retrieved === 'test');
        } catch (e) {
            console.error('[Gun.js] LocalStorage test failed:', e);
        }
    }

    private async ensureGun() {
        if (!this.gun && typeof window !== 'undefined') {
            await this.initGun();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        return this.gun;
    }

    async get<T>(path: string): Promise<Record<string, T> | null> {
        const gun = await this.ensureGun();
        if (!gun) return null;

        return new Promise((resolve) => {
            const data: Record<string, T> = {};

            gun.get(APP_NAMESPACE).get(path).map().once((item: T & { _?: unknown }, key: string) => {
                if (item && key && key !== '_') {
                    const cleanItem = { ...item };
                    delete cleanItem._;
                    data[key] = cleanItem as T;
                }
            });

            setTimeout(() => {
                console.log('[Gun.js] Get:', path, '→', Object.keys(data).length, 'items');
                resolve(Object.keys(data).length > 0 ? data : null);
            }, 2000);
        });
    }

    async set<T extends object>(path: string, key: string, value: T): Promise<void> {
        const gun = await this.ensureGun();
        if (!gun) {
            console.error('[Gun.js] Set failed: Gun not initialized');
            return;
        }

        console.log('[Gun.js] Attempting to set:', { path, key, valueKeys: Object.keys(value) });

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.error('[Gun.js] Set timeout for key:', key);
                resolve();
            }, 5000);

            gun.get(APP_NAMESPACE).get(path).get(key).put(value, (ack: { err?: string; ok?: number }) => {
                clearTimeout(timeout);
                if (ack.err) {
                    console.error('[Gun.js] Set error:', { key, error: ack.err });
                } else {
                    console.log('[Gun.js] Set success:', { key, ack });

                    // Verify localStorage
                    try {
                        const lsKeys = Object.keys(localStorage).filter(k => k.includes('gun') || k.includes(APP_NAMESPACE));
                        console.log('[Gun.js] LocalStorage keys after set:', lsKeys.length);
                    } catch (e) {
                        console.error('[Gun.js] LocalStorage check failed:', e);
                    }
                }
                resolve();
            });
        });
    }

    subscribe<T>(
        path: string,
        callback: (data: Record<string, T>) => void
    ): () => void {
        const data: Record<string, T> = {};
        let debounceTimeout: NodeJS.Timeout;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let ref: any = null;

        this.ensureGun().then((gun) => {
            if (!gun) return;

            ref = gun.get(APP_NAMESPACE).get(path).map();

            ref.on((item: T & { _?: unknown } | null, key: string) => {
                if (!key || key === '_') return;

                if (item === null) {
                    delete data[key];
                } else if (item) {
                    const cleanItem = { ...item };
                    delete cleanItem._;
                    data[key] = cleanItem as T;
                }

                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    console.log('[Gun.js] Sync:', Object.keys(data).length, 'files');
                    callback({ ...data });
                }, 100);
            });
        });

        return () => {
            if (ref) ref.off();
            clearTimeout(debounceTimeout);
        };
    }

    async delete(path: string, key: string): Promise<void> {
        const gun = await this.ensureGun();
        if (!gun) return;

        return new Promise((resolve) => {
            gun.get(APP_NAMESPACE).get(path).get(key).put(null, () => {
                console.log('[Gun.js] Deleted:', key);
                resolve();
            });
        });
    }

    async exists(path: string, key: string): Promise<boolean> {
        const gun = await this.ensureGun();
        if (!gun) return false;

        return new Promise((resolve) => {
            gun.get(APP_NAMESPACE).get(path).get(key).once((data: unknown) => {
                resolve(data !== null && data !== undefined);
            });
        });
    }

    getDeviceId(): string {
        return this.deviceId;
    }

    /**
     * Save file metadata with optional owner
     */
    async saveFile(file: GunFileMetadata, ownerId?: string): Promise<void> {
        const fileWithOwner = ownerId ? { ...file, ownerId } : file;
        await this.set('files', file.id, fileWithOwner);
    }

    /**
     * Get all files, optionally filtered by owner
     */
    async getFiles(ownerId?: string): Promise<GunFileMetadata[]> {
        const data = await this.get<GunFileMetadata>('files');
        if (!data) return [];

        const files = Object.values(data);

        if (ownerId) {
            return files.filter(f => f.ownerId === ownerId);
        }

        return files;
    }

    /**
     * Get a single file by ID
     */
    async getFile(fileId: string): Promise<GunFileMetadata | null> {
        const gun = await this.ensureGun();
        if (!gun) return null;

        return new Promise((resolve) => {
            gun.get(APP_NAMESPACE).get('files').get(fileId).once((data: GunFileMetadata & { _?: unknown } | null) => {
                if (data) {
                    const cleanData = { ...data };
                    delete cleanData._;
                    resolve(cleanData as GunFileMetadata);
                } else {
                    resolve(null);
                }
            });
        });
    }

    /**
     * Delete a file
     */
    async deleteFile(fileId: string): Promise<void> {
        await this.delete('files', fileId);
    }

    /**
     * Transfer file ownership to a new user
     */
    async transferOwnership(fileId: string, newOwnerId: string): Promise<void> {
        const file = await this.getFile(fileId);
        if (!file) {
            throw new Error(`File not found: ${fileId}`);
        }

        await this.set('files', fileId, { ...file, ownerId: newOwnerId });
        console.log('[Gun.js] Transferred ownership of', fileId, 'to', newOwnerId);
    }

    /**
     * Check if a user owns a file
     */
    async isFileOwner(fileId: string, ownerId: string): Promise<boolean> {
        const file = await this.getFile(fileId);
        if (!file) return false;

        // If no owner set, check device ID for backward compatibility
        if (!file.ownerId) {
            return file.deviceId === this.deviceId;
        }

        return file.ownerId === ownerId;
    }
}
