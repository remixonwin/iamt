/**
 * Gun.js Database Adapter
 * 
 * Uses the shared GunConnectionManager for Gun.js operations.
 * Added: localStorage backup for offline persistence
 */

'use client';

import { logger, LogCategory } from '@/shared/utils/logger';
import { SYNC_CONFIG } from '@/shared/config';
import { gunConnection } from './gunConnection';

// App namespace
const APP_NAMESPACE = 'iamt-files-v3';

// LocalStorage key for backup persistence
const LOCALSTORAGE_BACKUP_KEY = 'iamt-files-backup';

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
    /** SHA-256 hash of original content for deduplication (stored in user's encrypted graph only) */
    contentHash?: string;
    /** Whether this file was deduplicated (reused existing storage) */
    deduplicated?: boolean;

    // Ownership fields
    /** Owner user ID (DID or public key) */
    ownerId?: string;
    /** Owner display name (for public files) */
    ownerName?: string;
    /** Owner avatar file ID */
    ownerAvatarId?: string;
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
    private deviceId: string;

    constructor() {
        this.deviceId = getDeviceId();

        // Ensure connection is initialized
        if (typeof window !== 'undefined') {
            gunConnection.ensureGun();
        }
    }

    /**
     * Get the Gun instance from the connection manager
     */
    private async ensureGun() {
        return gunConnection.getGun();
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
        // ALWAYS save to localStorage backup FIRST (before any async operations)
        // This ensures persistence even when Gun.js fails or the relay is down
        if (path === 'files') {
            this.saveToLocalBackup(key, value as unknown as GunFileMetadata);
        }

        const gun = await this.ensureGun();
        if (!gun) {
            logger.warn(LogCategory.GUN, 'Gun not initialized - data saved to localStorage backup only');
            return;
        }

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                logger.warn(LogCategory.GUN, 'Set timeout for key', key);
                resolve();
            }, SYNC_CONFIG.gun.operationTimeout);

            gun.get(APP_NAMESPACE).get(path).get(key).put(value, (ack: { err?: string; ok?: number }) => {
                clearTimeout(timeout);
                if (ack.err) {
                    logger.warn(LogCategory.GUN, 'Set error', { key, error: ack.err });
                }
                resolve();
            });
        });
    }

    /**
     * Save file metadata to localStorage backup
     */
    private saveToLocalBackup(fileId: string, metadata: GunFileMetadata): void {
        try {
            const existing = localStorage.getItem(LOCALSTORAGE_BACKUP_KEY);
            const files: Record<string, GunFileMetadata> = existing ? JSON.parse(existing) : {};
            files[fileId] = metadata;
            localStorage.setItem(LOCALSTORAGE_BACKUP_KEY, JSON.stringify(files));
            logger.debug(LogCategory.GUN, 'Saved to localStorage backup', fileId);
        } catch (e) {
            logger.error(LogCategory.GUN, 'Failed to save to localStorage backup', e);
        }
    }

    /**
     * Load files from localStorage backup (fallback when Gun.js fails)
     */
    loadFromLocalBackup(): Record<string, GunFileMetadata> {
        try {
            const stored = localStorage.getItem(LOCALSTORAGE_BACKUP_KEY);
            if (stored) {
                const files = JSON.parse(stored);
                logger.debug(LogCategory.GUN, 'Loaded from localStorage backup', { count: Object.keys(files).length });
                return files;
            }
        } catch (e) {
            logger.error(LogCategory.GUN, 'Failed to load from localStorage backup', e);
        }
        return {};
    }

    /**
     * Delete from localStorage backup
     */
    private deleteFromLocalBackup(fileId: string): void {
        try {
            const existing = localStorage.getItem(LOCALSTORAGE_BACKUP_KEY);
            if (existing) {
                const files: Record<string, GunFileMetadata> = JSON.parse(existing);
                delete files[fileId];
                localStorage.setItem(LOCALSTORAGE_BACKUP_KEY, JSON.stringify(files));
                logger.debug(LogCategory.GUN, 'Deleted from localStorage backup', fileId);
            }
        } catch (e) {
            logger.error(LogCategory.GUN, 'Failed to delete from localStorage backup', e);
        }
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
                try {
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
                        logger.debug(LogCategory.GUN, 'Sync', { count: Object.keys(data).length });
                        callback({ ...data });
                    }, 100);
                } catch (err) {
                    logger.error(LogCategory.GUN, 'Error processing item', { key, err });
                }
            });
        }).catch(err => {
            logger.error(LogCategory.GUN, 'Subscribe failed', err);
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
                logger.debug(LogCategory.GUN, 'Deleted', key);
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

    /**
     * Save a file to the User's Graph (Private/Personal Storage)
     * This ensures the file is synced to the user's account across devices
     */
    async saveUserFile(file: GunFileMetadata, user: any, userId: string): Promise<void> {
        if (!user || !user.is) throw new Error('User not authenticated');

        // Save to user-specific localStorage backup FIRST
        this.saveToUserBackup(file.id, file, userId);

        return new Promise((resolve, reject) => {
            // Save to user's 'files' graph
            user.get(APP_NAMESPACE).get('files').get(file.id).put(file, (ack: { err?: string }) => {
                if (ack.err) {
                    logger.error(LogCategory.GUN, 'Failed to save to User Graph', ack.err);
                    reject(new Error(ack.err));
                } else {
                    logger.info(LogCategory.GUN, 'Saved to User Graph', file.id);
                    // Also save to global graph for discovery if public, 
                    // or for availability if private (encrypted blob still needs to be found)
                    if (file.visibility === 'public') {
                        this.set('files', file.id, file).then(() => resolve());
                    } else {
                        resolve();
                    }
                }
            });
        });
    }

    /**
     * Get files from the User's Graph
     */
    async getUserFiles(user: any): Promise<GunFileMetadata[]> {
        if (!user || !user.is) return [];

        return new Promise((resolve) => {
            const files: Record<string, GunFileMetadata> = {};

            user.get(APP_NAMESPACE).get('files').map().once((data: GunFileMetadata & { _?: unknown }, key: string) => {
                if (data && key && key !== '_') {
                    const cleanData = { ...data };
                    delete cleanData._;
                    files[key] = cleanData as GunFileMetadata;
                }
            });

            // Wait a bit for data to gather
            setTimeout(() => {
                logger.debug(LogCategory.GUN, 'Loaded from User Graph', { count: Object.keys(files).length });
                resolve(Object.values(files));
            }, SYNC_CONFIG.gun.initializationTimeout);
        });
    }

    /**
     * Subscribe to the User's file graph for real-time cross-device sync
     */
    subscribeUserFiles(
        user: any,
        callback: (data: Record<string, GunFileMetadata>) => void
    ): () => void {
        if (!user || !user.is) {
            logger.warn(LogCategory.GUN, 'Cannot subscribe to user files - not authenticated');
            return () => { };
        }

        const data: Record<string, GunFileMetadata> = {};
        let debounceTimeout: NodeJS.Timeout;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ref = user.get(APP_NAMESPACE).get('files').map();

        ref.on((item: GunFileMetadata & { _?: unknown } | null, key: string) => {
            if (!key || key === '_') return;

            if (item === null) {
                delete data[key];
            } else if (item) {
                const cleanItem = { ...item };
                delete cleanItem._;
                data[key] = cleanItem as GunFileMetadata;
            }

            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                logger.debug(LogCategory.GUN, 'User files sync', { count: Object.keys(data).length });
                callback({ ...data });
            }, 100);
        });

        return () => {
            ref.off();
            clearTimeout(debounceTimeout);
        };
    }

    /**
     * Save file metadata to user-specific localStorage backup
     * Keyed by user ID for cross-device sync
     */
    private saveToUserBackup(fileId: string, metadata: GunFileMetadata, userId: string): void {
        try {
            const backupKey = `iamt-user-files-${userId}`;
            const existing = localStorage.getItem(backupKey);
            const files: Record<string, GunFileMetadata> = existing ? JSON.parse(existing) : {};
            files[fileId] = metadata;
            localStorage.setItem(backupKey, JSON.stringify(files));
            logger.debug(LogCategory.GUN, 'Saved to user localStorage backup', fileId);
        } catch (e) {
            logger.error(LogCategory.GUN, 'Failed to save to user localStorage backup', e);
        }
    }

    /**
     * Load files from user-specific localStorage backup
     */
    loadUserFilesBackup(userId: string): Record<string, GunFileMetadata> {
        try {
            const backupKey = `iamt-user-files-${userId}`;
            const stored = localStorage.getItem(backupKey);
            if (stored) {
                const files = JSON.parse(stored);
                logger.debug(LogCategory.GUN, 'Loaded from user localStorage backup', { count: Object.keys(files).length });
                return files;
            }
        } catch (e) {
            logger.error(LogCategory.GUN, 'Failed to load from user localStorage backup', e);
        }
        return {};
    }

    /**
     * Delete from user-specific localStorage backup
     */
    deleteFromUserBackup(fileId: string, userId: string): void {
        try {
            const backupKey = `iamt-user-files-${userId}`;
            const existing = localStorage.getItem(backupKey);
            if (existing) {
                const files: Record<string, GunFileMetadata> = JSON.parse(existing);
                delete files[fileId];
                localStorage.setItem(backupKey, JSON.stringify(files));
                logger.debug(LogCategory.GUN, 'Deleted from user localStorage backup', fileId);
            }
        } catch (e) {
            logger.error(LogCategory.GUN, 'Failed to delete from user localStorage backup', e);
        }
    }
}
