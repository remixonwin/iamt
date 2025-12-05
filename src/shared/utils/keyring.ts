/**
 * Local Keyring Module
 * 
 * Securely stores encryption keys in IndexedDB.
 * Keys never leave the device - only the file owner can decrypt.
 * 
 * Security Features:
 * - Keys stored in browser's IndexedDB (sandboxed per origin)
 * - Supports key export for backup
 * - Automatic cleanup of orphaned keys
 */

const KEYRING_DB_NAME = 'iamt-keyring';
const KEYRING_DB_VERSION = 1;
const KEYS_STORE = 'encryption-keys';

export interface KeyEntry {
    /** File ID (CID or info hash) */
    fileId: string;
    /** Base64 encoded AES-256 key */
    key: string;
    /** Base64 encoded IV */
    iv: string;
    /** Original file name (for reference) */
    fileName: string;
    /** Original MIME type (needed for decryption) */
    mimeType: string;
    /** Timestamp when key was created */
    createdAt: number;
    /** Optional password salt for password-protected files */
    salt?: string;
    /** Whether this is password-protected (key is derived, not stored) */
    isPasswordProtected: boolean;
}

/**
 * Open the keyring database
 */
function openKeyringDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB not available'));
            return;
        }

        const request = indexedDB.open(KEYRING_DB_NAME, KEYRING_DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            
            if (!db.objectStoreNames.contains(KEYS_STORE)) {
                const store = db.createObjectStore(KEYS_STORE, { keyPath: 'fileId' });
                store.createIndex('createdAt', 'createdAt', { unique: false });
                store.createIndex('fileName', 'fileName', { unique: false });
            }
        };
    });
}

/**
 * Local Keyring for managing encryption keys
 */
export class LocalKeyring {
    private dbPromise: Promise<IDBDatabase> | null = null;

    /**
     * Get database instance (lazy initialization)
     */
    private async getDb(): Promise<IDBDatabase> {
        if (!this.dbPromise) {
            this.dbPromise = openKeyringDatabase();
        }
        return this.dbPromise;
    }

    /**
     * Store an encryption key for a file
     * 
     * @param fileId - Unique file identifier (CID/info hash)
     * @param key - Base64 encoded encryption key
     * @param iv - Base64 encoded IV
     * @param fileName - Original file name
     * @param mimeType - Original MIME type
     */
    async storeKey(
        fileId: string,
        key: string,
        iv: string,
        fileName: string,
        mimeType: string
    ): Promise<void> {
        const db = await this.getDb();
        
        const entry: KeyEntry = {
            fileId,
            key,
            iv,
            fileName,
            mimeType,
            createdAt: Date.now(),
            isPasswordProtected: false,
        };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([KEYS_STORE], 'readwrite');
            const store = transaction.objectStore(KEYS_STORE);
            const request = store.put(entry);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log('[Keyring] Stored key for:', fileId);
                resolve();
            };
        });
    }

    /**
     * Store metadata for a password-protected file
     * (The actual key is derived from password, not stored)
     */
    async storePasswordProtectedMeta(
        fileId: string,
        salt: string,
        iv: string,
        fileName: string,
        mimeType: string
    ): Promise<void> {
        const db = await this.getDb();
        
        const entry: KeyEntry = {
            fileId,
            key: '', // No key stored - derived from password
            iv,
            salt,
            fileName,
            mimeType,
            createdAt: Date.now(),
            isPasswordProtected: true,
        };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([KEYS_STORE], 'readwrite');
            const store = transaction.objectStore(KEYS_STORE);
            const request = store.put(entry);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log('[Keyring] Stored password-protected meta for:', fileId);
                resolve();
            };
        });
    }

    /**
     * Retrieve a key entry for a file
     */
    async getKey(fileId: string): Promise<KeyEntry | null> {
        const db = await this.getDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([KEYS_STORE], 'readonly');
            const store = transaction.objectStore(KEYS_STORE);
            const request = store.get(fileId);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                resolve(request.result || null);
            };
        });
    }

    /**
     * Check if we have a key for a file
     */
    async hasKey(fileId: string): Promise<boolean> {
        const key = await this.getKey(fileId);
        return key !== null;
    }

    /**
     * Delete a key entry
     */
    async deleteKey(fileId: string): Promise<void> {
        const db = await this.getDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([KEYS_STORE], 'readwrite');
            const store = transaction.objectStore(KEYS_STORE);
            const request = store.delete(fileId);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log('[Keyring] Deleted key for:', fileId);
                resolve();
            };
        });
    }

    /**
     * Get all stored keys (for backup/export)
     */
    async getAllKeys(): Promise<KeyEntry[]> {
        const db = await this.getDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([KEYS_STORE], 'readonly');
            const store = transaction.objectStore(KEYS_STORE);
            const request = store.getAll();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                resolve(request.result || []);
            };
        });
    }

    /**
     * Export keyring as JSON for backup
     */
    async exportKeyring(): Promise<string> {
        const keys = await this.getAllKeys();
        return JSON.stringify({
            version: 1,
            exportedAt: Date.now(),
            keys: keys.filter(k => !k.isPasswordProtected), // Don't export password-protected meta
        }, null, 2);
    }

    /**
     * Import keyring from JSON backup
     */
    async importKeyring(jsonData: string): Promise<number> {
        const data = JSON.parse(jsonData);
        
        if (!data.keys || !Array.isArray(data.keys)) {
            throw new Error('Invalid keyring backup format');
        }

        const db = await this.getDb();
        let imported = 0;

        for (const entry of data.keys) {
            if (entry.fileId && entry.key && entry.iv) {
                await new Promise<void>((resolve, reject) => {
                    const transaction = db.transaction([KEYS_STORE], 'readwrite');
                    const store = transaction.objectStore(KEYS_STORE);
                    const request = store.put({
                        ...entry,
                        createdAt: entry.createdAt || Date.now(),
                        isPasswordProtected: false,
                    });

                    request.onerror = () => reject(request.error);
                    request.onsuccess = () => {
                        imported++;
                        resolve();
                    };
                });
            }
        }

        console.log('[Keyring] Imported', imported, 'keys');
        return imported;
    }

    /**
     * Clear all keys (use with caution!)
     */
    async clearAll(): Promise<void> {
        const db = await this.getDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([KEYS_STORE], 'readwrite');
            const store = transaction.objectStore(KEYS_STORE);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log('[Keyring] Cleared all keys');
                resolve();
            };
        });
    }

    /**
     * Get statistics about stored keys
     */
    async getStats(): Promise<{ total: number; privateFiles: number; passwordProtected: number }> {
        const keys = await this.getAllKeys();
        return {
            total: keys.length,
            privateFiles: keys.filter(k => !k.isPasswordProtected).length,
            passwordProtected: keys.filter(k => k.isPasswordProtected).length,
        };
    }
}

// Singleton instance for the app
let keyringInstance: LocalKeyring | null = null;

/**
 * Get the global keyring instance
 */
export function getKeyring(): LocalKeyring {
    if (!keyringInstance) {
        keyringInstance = new LocalKeyring();
    }
    return keyringInstance;
}
