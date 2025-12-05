/**
 * Gun.js Database Adapter
 * 
 * Provides real-time P2P sync of file metadata across devices.
 * Uses public Gun relays for connectivity.
 */

'use client';

import Gun from 'gun';

// Public Gun relays for P2P connectivity
const RELAYS = [
    'https://gun-manhattan.herokuapp.com/gun',
    'https://gun-us.herokuapp.com/gun',
];

// App namespace to avoid conflicts with other Gun apps
const APP_NAMESPACE = 'iamt-files';

// Type for file metadata stored in Gun
export interface GunFileMetadata {
    id: string;
    name: string;
    size: number;
    type: string;
    createdAt: number;
    deviceId: string;
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
 * 
 * Syncs file metadata in real-time across all connected devices.
 * Note: This is a standalone adapter that doesn't implement DatabaseAdapter
 * interface due to Gun.js's unique API requirements.
 * 
 * @example
 * ```typescript
 * const db = new GunDatabaseAdapter();
 * 
 * // Subscribe to file list updates
 * db.subscribe('files', (files) => {
 *   console.log('Files updated:', files);
 * });
 * 
 * // Add a file
 * await db.set('files', fileId, { name: 'doc.pdf', size: 1024 });
 * ```
 */
export class GunDatabaseAdapter {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private gun: any;
    private deviceId: string;

    constructor() {
        this.gun = Gun({ peers: RELAYS });
        this.deviceId = getDeviceId();
    }

    /**
     * Get all items at a path
     */
    async get<T>(path: string): Promise<Record<string, T> | null> {
        return new Promise((resolve) => {
            const data: Record<string, T> = {};
            let resolved = false;

            this.gun.get(APP_NAMESPACE).get(path).map().once((item: T, key: string) => {
                if (item && key !== '_') {
                    data[key] = item;
                }
            });

            // Gun doesn't have a clean "done" event, so we use timeout
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    resolve(Object.keys(data).length > 0 ? data : null);
                }
            }, 500);
        });
    }

    /**
     * Set a value at a path
     */
    async set<T>(path: string, key: string, value: T): Promise<void> {
        return new Promise((resolve, reject) => {
            this.gun.get(APP_NAMESPACE).get(path).get(key).put(value, (ack: { err?: string }) => {
                if (ack.err) {
                    reject(new Error(ack.err));
                } else {
                    resolve();
                }
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

        const ref = this.gun.get(APP_NAMESPACE).get(path).map().on((item: T, key: string) => {
            if (key && key !== '_') {
                // Handle Gun's null tombstone for deleted items
                if (item === null) {
                    delete data[key];
                } else if (item) {
                    data[key] = item;
                }
                callback({ ...data });
            }
        });

        // Return unsubscribe function
        return () => {
            ref.off();
        };
    }

    /**
     * Delete a value
     */
    async delete(path: string, key: string): Promise<void> {
        return new Promise((resolve) => {
            this.gun.get(APP_NAMESPACE).get(path).get(key).put(null, () => {
                resolve();
            });
        });
    }

    /**
     * Check if a key exists
     */
    async exists(path: string, key: string): Promise<boolean> {
        return new Promise((resolve) => {
            this.gun.get(APP_NAMESPACE).get(path).get(key).once((data: unknown) => {
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
