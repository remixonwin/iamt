/**
 * Gun.js Database Adapter
 * 
 * Connects to local relay in development, public relay in production.
 */

'use client';

// Use environment variable or fallback to localhost
const PRIMARY_RELAY = process.env.NEXT_PUBLIC_GUN_RELAY || 'http://localhost:8765/gun';

// Fallback relays (updated - Heroku relays deprecated)
const FALLBACK_RELAYS: string[] = [];

// All relays - primary first, then fallbacks
// In production without custom relay, use public relays only
const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
const RELAYS = isProduction && PRIMARY_RELAY.includes('localhost') 
    ? FALLBACK_RELAYS 
    : [PRIMARY_RELAY, ...FALLBACK_RELAYS];

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

        this.gun = Gun({
            peers: RELAYS,
            localStorage: true,
        });

        console.log('[Gun.js] Connecting to:', PRIMARY_RELAY);
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
        if (!gun) return;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log('[Gun.js] Set timeout:', key);
                resolve();
            }, 5000);

            gun.get(APP_NAMESPACE).get(path).get(key).put(value, (ack: { err?: string }) => {
                clearTimeout(timeout);
                if (ack.err) {
                    console.error('[Gun.js] Set error:', ack.err);
                } else {
                    console.log('[Gun.js] Set success:', key);
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
}
