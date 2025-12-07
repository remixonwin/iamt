/**
 * Gun.js Connection Manager
 * 
 * Provides a single shared Gun.js instance across the application.
 * Eliminates duplicate initialization in GunSeaAdapter and GunDatabaseAdapter.
 * 
 * Features:
 * - Singleton pattern for single Gun instance
 * - Observable connection state
 * - Lazy initialization on first access
 * - Centralized relay configuration
 */

'use client';

import { logger, LogCategory } from '@/shared/utils/logger';
import { SYNC_CONFIG } from '@/shared/config';

// Gun.js relay configuration
const PRIMARY_RELAY = process.env.NEXT_PUBLIC_GUN_RELAY;

// Optional comma-separated list from env
const ENV_RELAYS = (process.env.NEXT_PUBLIC_GUN_RELAYS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

// Default public relays (tested working)
const DEFAULT_PUBLIC_RELAYS: string[] = [
    'https://relay.peer.ooo/gun',
    'https://relay.gun.eco/gun',
    'https://relay-us.gundb.io/gun'
];

// Determine if running in production
const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');

// E2E test mode - skip actual Gun.js initialization
const isE2EMode = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_E2E_MODE === 'true';

// Build relay list with deduplication and security filtering
const RELAYS = Array.from(
    new Set(
        [
            ...(PRIMARY_RELAY ? [PRIMARY_RELAY] : []),
            ...ENV_RELAYS,
            ...DEFAULT_PUBLIC_RELAYS,
        ].filter((url) => {
            if (!url) return false;
            // Drop insecure endpoints in production (except localhost for dev tunneling)
            if (isProduction && url.startsWith('http://') && !url.includes('localhost')) {
                logger.warn(LogCategory.GUN, 'Skipping insecure relay in production', url);
                return false;
            }
            return true;
        })
    )
);

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface ConnectionStatus {
    state: ConnectionState;
    relays: string[];
    connectedPeers: number;
    lastConnectionTime: number | null;
}

type ConnectionChangeCallback = (status: ConnectionStatus) => void;

/**
 * Gun.js Connection Manager - Singleton
 */
class GunConnectionManager {
    private static instance: GunConnectionManager;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private gun: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private user: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private SEA: any = null;

    private initialized = false;
    private initializing = false;
    private connectionState: ConnectionState = 'disconnected';
    private lastConnectionTime: number | null = null;
    private connectedPeers = 0;

    private connectionListeners: ConnectionChangeCallback[] = [];
    private readyPromise: Promise<void> | null = null;
    private resolveReady: (() => void) | null = null;

    private constructor() {
        // Private constructor for singleton
        this.readyPromise = new Promise((resolve) => {
            this.resolveReady = resolve;
        });
    }

    static getInstance(): GunConnectionManager {
        if (!GunConnectionManager.instance) {
            GunConnectionManager.instance = new GunConnectionManager();
        }
        return GunConnectionManager.instance;
    }

    /**
     * Initialize Gun.js with SEA
     */
    private async initGun(): Promise<void> {
        if (this.initialized || this.initializing) return;
        if (typeof window === 'undefined') return;

        // E2E test mode - skip actual Gun.js initialization
        if (isE2EMode) {
            logger.info(LogCategory.GUN, 'E2E mode - skipping Gun.js initialization');
            this.initialized = true;
            this.setConnectionState('connected');
            this.lastConnectionTime = Date.now();
            this.resolveReady?.();
            return;
        }

        this.initializing = true;
        this.setConnectionState('connecting');

        try {
            const Gun = (await import('gun')).default;
            await import('gun/sea');

            logger.info(LogCategory.GUN, 'Environment', isProduction ? 'production' : 'development');
            logger.info(LogCategory.GUN, 'Connecting to relays', RELAYS);

            this.gun = Gun({
                peers: RELAYS,
                localStorage: true,
            });

            // Suppress WebSocket connection errors in production
            if (isProduction) {
                this.gun.on('error', (err: Error | { message?: string } | null) => {
                    // Only log critical errors, not connection failures
                    if (!err?.message?.includes('WebSocket') && !err?.message?.includes('connection')) {
                        logger.warn(LogCategory.GUN, 'Error', err);
                    }
                });
            }

            // Create user instance for SEA operations
            this.user = this.gun.user();
            this.SEA = (Gun as { SEA?: unknown }).SEA;

            // Monitor peer connections (best effort)
            this.monitorPeers();

            this.initialized = true;
            this.setConnectionState('connected');
            this.lastConnectionTime = Date.now();

            logger.info(LogCategory.GUN, 'Initialized successfully', { relays: RELAYS.length });

            // Verify localStorage is accessible
            this.verifyLocalStorage();

        } catch (error) {
            logger.error(LogCategory.GUN, 'Initialization failed', error);
            this.setConnectionState('disconnected');
        } finally {
            this.initializing = false;
            this.resolveReady?.();
        }
    }

    /**
     * Monitor peer connections
     */
    private monitorPeers(): void {
        if (!this.gun) return;

        // Gun.js doesn't expose peer count directly, but we can monitor via _.opt.peers
        const checkPeers = () => {
            try {
                const peers = this.gun?._.opt?.peers;
                if (peers) {
                    this.connectedPeers = Object.keys(peers).filter(
                        p => peers[p]?.wire?.readyState === 1
                    ).length;
                }
            } catch {
                // Ignore peer monitoring errors
            }
        };

        // Check peers periodically
        setInterval(checkPeers, 5000);
        checkPeers();
    }

    /**
     * Verify localStorage is accessible
     */
    private verifyLocalStorage(): void {
        try {
            const testKey = `gun-test-${Date.now()}`;
            localStorage.setItem(testKey, 'test');
            const retrieved = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);
            logger.debug(LogCategory.GUN, 'LocalStorage verified', retrieved === 'test');
        } catch (e) {
            logger.error(LogCategory.GUN, 'LocalStorage test failed', e);
        }
    }

    /**
     * Set connection state and notify listeners
     */
    private setConnectionState(state: ConnectionState): void {
        if (this.connectionState === state) return;

        this.connectionState = state;
        const status = this.getStatus();

        for (const listener of this.connectionListeners) {
            try {
                listener(status);
            } catch (err) {
                logger.error(LogCategory.GUN, 'Connection listener error', err);
            }
        }
    }

    /**
     * Ensure Gun.js is initialized
     */
    async ensureGun(): Promise<void> {
        if (typeof window === 'undefined') return;

        if (!this.initialized && !this.initializing) {
            await this.initGun();
        }

        // Wait for initialization to complete
        await this.readyPromise;

        // Additional wait if initialization took longer
        const startTime = Date.now();
        while ((!this.gun || !this.SEA) && Date.now() - startTime < SYNC_CONFIG.gun.initializationTimeout) {
            await new Promise(r => setTimeout(r, 50));
        }
    }

    /**
     * Get the Gun.js instance
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getGun(): Promise<any> {
        await this.ensureGun();
        return this.gun;
    }

    /**
     * Get the Gun.js user instance for SEA operations
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getUser(): Promise<any> {
        await this.ensureGun();
        return this.user;
    }

    /**
     * Get the SEA module
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getSEA(): Promise<any> {
        await this.ensureGun();
        return this.SEA;
    }

    /**
     * Get raw instances synchronously (use with caution - may be null)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getGunSync(): any {
        return this.gun;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getUserSync(): any {
        return this.user;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSEASync(): any {
        return this.SEA;
    }

    /**
     * Get current connection status
     */
    getStatus(): ConnectionStatus {
        return {
            state: this.connectionState,
            relays: RELAYS,
            connectedPeers: this.connectedPeers,
            lastConnectionTime: this.lastConnectionTime,
        };
    }

    /**
     * Subscribe to connection state changes
     */
    onConnectionChange(callback: ConnectionChangeCallback): () => void {
        this.connectionListeners.push(callback);

        // Immediately call with current status
        callback(this.getStatus());

        // Return unsubscribe function
        return () => {
            const index = this.connectionListeners.indexOf(callback);
            if (index > -1) {
                this.connectionListeners.splice(index, 1);
            }
        };
    }

    /**
     * Check if connection is ready
     */
    isReady(): boolean {
        return this.initialized && this.gun !== null && this.SEA !== null;
    }

    /**
     * Get the relay list
     */
    getRelays(): string[] {
        return [...RELAYS];
    }
}

/**
 * Get the singleton connection manager instance
 */
export function getGunConnection(): GunConnectionManager {
    return GunConnectionManager.getInstance();
}

/**
 * Convenience exports for direct access
 */
export const gunConnection = GunConnectionManager.getInstance();
