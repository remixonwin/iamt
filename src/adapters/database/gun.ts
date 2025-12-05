/**
 * Gun.js Database Adapter
 * 
 * Provides real-time P2P sync of file metadata across devices.
 * Client-side only - Gun.js doesn't work in SSR.
 */

'use client';

// Multiple relay servers for better connectivity
const RELAYS = [
    'https://gun-manhattan.herokuapp.com/gun',
    'https://gun-matrix.herokuapp.com/gun',
    'https://gun-ams1.madmex.io:8765/gun',
    'https://gun-sjc1.madmex.io:8765/gun',
    'https://gunjs.herokuapp.com/gun',
    'https://gun-eu.herokuapp.com/gun',
    'https://gun-nyc.herokuapp.com/gun',
    'https://e2eec.herokuapp.com/gun',
];

// App namespace
const APP_NAMESPACE = 'iamt-files-v2';

// Type for file metadata
export interface GunFileMetadata {
    id: string;
    name: string;
    size: number;
    type: string;
    createdAt: number;
    deviceId: string;
    url?: string;
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
 * Gun.js Database Adapter with improved reliability
 * Note: Must be used client-side only
 */
export class GunDatabaseAdapter {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private gun: any = null;
    private deviceId: string;
    private initialized = false;

    constructor() {
        this.deviceId = getDeviceId();

        // Only initialize Gun.js on client side
        if (typeof window !== 'undefined') {
            this.initGun();
        }
    }

    private async initGun() {
        if (this.initialized) return;
        this.initialized = true;

        // Dynamic import to avoid SSR issues
        const Gun = (await import('gun')).default;

        // Initialize Gun with multiple peers
        this.gun = Gun({
            peers: RELAYS,
            localStorage: true,
        });

        console.log('[Gun.js] Connecting to', RELAYS.length, 'relays...');
    }

    private async ensureGun() {
        if (!this.gun && typeof window !== 'undefined') {
            await this.initGun();
            // Small delay to let Gun connect
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return this.gun;
    }

    /**
     * Get all items at a path
     */
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
                resolve(Object.keys(data).length > 0 ? data : null);
            }, 2000);
        });
    }

    /**
     * Set a value at a path
     */
    async set<T extends object>(path: string, key: string, value: T): Promise<void> {
        const gun = await this.ensureGun();
        if (!gun) return;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log('[Gun.js] Set timeout, data may sync later');
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

    /**
     * Subscribe to real-time updates
     */
    subscribe<T>(
        path: string,
        callback: (data: Record<string, T>) => void
    ): () => void {
        const data: Record<string, T> = {};
        let debounceTimeout: NodeJS.Timeout;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let ref: any = null;

        // Initialize asynchronously
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
                    console.log('[Gun.js] Sync update:', Object.keys(data).length, 'items');
                    callback({ ...data });
                }, 100);
            });
        });

        return () => {
            if (ref) ref.off();
            clearTimeout(debounceTimeout);
        };
    }

    /**
     * Delete a value
     */
    async delete(path: string, key: string): Promise<void> {
        const gun = await this.ensureGun();
        if (!gun) return;

        return new Promise((resolve) => {
            gun.get(APP_NAMESPACE).get(path).get(key).put(null, () => {
                console.log('[Gun.js] Delete:', key);
                resolve();
            });
        });
    }

    /**
     * Check if a key exists
     */
    async exists(path: string, key: string): Promise<boolean> {
        const gun = await this.ensureGun();
        if (!gun) return false;

        return new Promise((resolve) => {
            gun.get(APP_NAMESPACE).get(path).get(key).once((data: unknown) => {
                resolve(data !== null && data !== undefined);
            });
        });
    }

    /**
     * Get the current device ID
     */
    getDeviceId(): string {
        return this.deviceId;
    }
}
