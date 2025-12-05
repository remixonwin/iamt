/**
 * Gun.js Database Adapter
 * 
 * Provides real-time P2P sync of file metadata across devices.
 */

'use client';

import Gun from 'gun';
import 'gun/sea';
import 'gun/lib/radix';
import 'gun/lib/radisk';
import 'gun/lib/store';
import 'gun/lib/rindexed';

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
 */
export class GunDatabaseAdapter {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private gun: any;
    private deviceId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private user: any;

    constructor() {
        // Initialize Gun with multiple peers and localStorage persistence
        this.gun = Gun({
            peers: RELAYS,
            localStorage: true,
            radisk: true,
        });

        this.deviceId = getDeviceId();
        this.user = this.gun.user();

        // Log connection status
        if (typeof window !== 'undefined') {
            console.log('[Gun.js] Connecting to relays...', RELAYS.length, 'peers');
        }
    }

    /**
     * Get all items at a path
     */
    async get<T>(path: string): Promise<Record<string, T> | null> {
        return new Promise((resolve) => {
            const data: Record<string, T> = {};
            let timeout: NodeJS.Timeout;

            const ref = this.gun.get(APP_NAMESPACE).get(path).map();

            ref.once((item: T & { _?: unknown }, key: string) => {
                if (item && key && key !== '_') {
                    // Remove Gun.js metadata
                    const cleanItem = { ...item };
                    delete cleanItem._;
                    data[key] = cleanItem as T;
                }
            });

            // Resolve after collecting data
            timeout = setTimeout(() => {
                resolve(Object.keys(data).length > 0 ? data : null);
            }, 2000);
        });
    }

    /**
     * Set a value at a path
     */
    async set<T extends object>(path: string, key: string, value: T): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                // Resolve anyway after timeout - Gun might still sync
                console.log('[Gun.js] Set timeout, data may sync later');
                resolve();
            }, 5000);

            this.gun.get(APP_NAMESPACE).get(path).get(key).put(value, (ack: { err?: string; ok?: number }) => {
                clearTimeout(timeout);
                if (ack.err) {
                    console.error('[Gun.js] Set error:', ack.err);
                    reject(new Error(ack.err));
                } else {
                    console.log('[Gun.js] Set success:', key);
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
        let debounceTimeout: NodeJS.Timeout;

        const ref = this.gun.get(APP_NAMESPACE).get(path).map();

        ref.on((item: T & { _?: unknown } | null, key: string) => {
            if (!key || key === '_') return;

            if (item === null) {
                // Deleted
                delete data[key];
            } else if (item) {
                // Clean Gun metadata
                const cleanItem = { ...item };
                delete cleanItem._;
                data[key] = cleanItem as T;
            }

            // Debounce updates
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                console.log('[Gun.js] Sync update:', Object.keys(data).length, 'items');
                callback({ ...data });
            }, 100);
        });

        // Return unsubscribe function
        return () => {
            ref.off();
            clearTimeout(debounceTimeout);
        };
    }

    /**
     * Delete a value
     */
    async delete(path: string, key: string): Promise<void> {
        return new Promise((resolve) => {
            this.gun.get(APP_NAMESPACE).get(path).get(key).put(null, () => {
                console.log('[Gun.js] Delete:', key);
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

    /**
     * Get connection status
     */
    isConnected(): boolean {
        // Gun.js doesn't have a simple connection status check
        // We assume connected if gun instance exists
        return !!this.gun;
    }
}
