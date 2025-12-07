/**
 * Content Index Module
 * 
 * User-local IndexedDB store for content-addressable deduplication.
 * Maps content hashes to storage IDs to avoid uploading duplicate files.
 * 
 * Privacy Features:
 * - Index is local per-user only (no cross-user correlation)
 * - Blinded hashes used for server queries
 * - Content hashes never leave the device unblinded
 */

const DB_NAME = 'iamt-content-index';
const DB_VERSION = 1;
const STORE_NAME = 'content-hashes';

export interface ContentIndexEntry {
    /** SHA-256 hash of original file content */
    contentHash: string;
    /** Storage identifier (InfoHash for WebTorrent) */
    storageId: string;
    /** Blinded hash for server queries: SHA-256(contentHash + userSecret) */
    blindedHash: string;
    /** File visibility when first stored */
    visibility: 'public' | 'private' | 'password-protected';
    /** Reference count for cleanup */
    refCount: number;
    /** Original file size in bytes */
    size: number;
    /** When this entry was created */
    createdAt: number;
    /** When this entry was last accessed */
    lastAccessedAt: number;
}

/**
 * Open the content index database
 */
function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB not available'));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'contentHash' });
                store.createIndex('storageId', 'storageId', { unique: false });
                store.createIndex('blindedHash', 'blindedHash', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };
    });
}

/**
 * Content Index for deduplication
 * 
 * Singleton class managing the local content hash index.
 */
class ContentIndex {
    private dbPromise: Promise<IDBDatabase> | null = null;

    private async getDb(): Promise<IDBDatabase> {
        if (!this.dbPromise) {
            this.dbPromise = openDatabase();
        }
        return this.dbPromise;
    }

    /**
     * Look up an entry by content hash
     */
    async lookup(contentHash: string): Promise<ContentIndexEntry | null> {
        const db = await this.getDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(contentHash);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const entry = request.result as ContentIndexEntry | undefined;
                if (entry) {
                    // Update last accessed time (fire and forget)
                    this.updateLastAccessed(contentHash).catch(() => {});
                }
                resolve(entry || null);
            };
        });
    }

    /**
     * Look up an entry by blinded hash (for server response matching)
     */
    async lookupByBlindedHash(blindedHash: string): Promise<ContentIndexEntry | null> {
        const db = await this.getDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('blindedHash');
            const request = index.get(blindedHash);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                resolve(request.result as ContentIndexEntry || null);
            };
        });
    }

    /**
     * Look up an entry by storage ID
     */
    async lookupByStorageId(storageId: string): Promise<ContentIndexEntry | null> {
        const db = await this.getDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('storageId');
            const request = index.get(storageId);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                resolve(request.result as ContentIndexEntry || null);
            };
        });
    }

    /**
     * Store a new content hash entry
     */
    async store(entry: ContentIndexEntry): Promise<void> {
        const db = await this.getDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(entry);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log('[ContentIndex] Stored entry:', entry.contentHash.slice(0, 16) + '...');
                resolve();
            };
        });
    }

    /**
     * Increment reference count for an existing entry
     */
    async incrementRefCount(contentHash: string): Promise<number> {
        const db = await this.getDb();
        const entry = await this.lookup(contentHash);
        
        if (!entry) {
            throw new Error('Content hash not found in index');
        }

        entry.refCount += 1;
        entry.lastAccessedAt = Date.now();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(entry);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log('[ContentIndex] Incremented refCount to', entry.refCount, 'for:', contentHash.slice(0, 16) + '...');
                resolve(entry.refCount);
            };
        });
    }

    /**
     * Decrement reference count; returns new count (0 means safe to delete)
     */
    async decrementRefCount(contentHash: string): Promise<number> {
        const db = await this.getDb();
        const entry = await this.lookup(contentHash);
        
        if (!entry) {
            return 0; // Already gone
        }

        entry.refCount = Math.max(0, entry.refCount - 1);

        if (entry.refCount === 0) {
            // Remove entry entirely
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.delete(contentHash);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    console.log('[ContentIndex] Removed entry (refCount=0):', contentHash.slice(0, 16) + '...');
                    resolve(0);
                };
            });
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(entry);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log('[ContentIndex] Decremented refCount to', entry.refCount, 'for:', contentHash.slice(0, 16) + '...');
                resolve(entry.refCount);
            };
        });
    }

    /**
     * Update last accessed timestamp
     */
    private async updateLastAccessed(contentHash: string): Promise<void> {
        const db = await this.getDb();
        const entry = await this.lookup(contentHash);
        
        if (!entry) return;

        entry.lastAccessedAt = Date.now();

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.put(entry);
            transaction.oncomplete = () => resolve();
        });
    }

    /**
     * Get statistics about the content index
     */
    async getStats(): Promise<{
        totalEntries: number;
        totalSize: number;
        totalRefCount: number;
    }> {
        const db = await this.getDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const entries = request.result as ContentIndexEntry[];
                resolve({
                    totalEntries: entries.length,
                    totalSize: entries.reduce((sum, e) => sum + e.size, 0),
                    totalRefCount: entries.reduce((sum, e) => sum + e.refCount, 0),
                });
            };
        });
    }

    /**
     * Clear all entries (for testing/reset)
     */
    async clear(): Promise<void> {
        const db = await this.getDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log('[ContentIndex] Cleared all entries');
                resolve();
            };
        });
    }
}

// Singleton instance
let contentIndexInstance: ContentIndex | null = null;

/**
 * Get the singleton content index instance
 */
export function getContentIndex(): ContentIndex {
    if (!contentIndexInstance) {
        contentIndexInstance = new ContentIndex();
    }
    return contentIndexInstance;
}
