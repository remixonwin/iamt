/**
 * IndexedDB Storage Adapter
 * 
 * Stores file blobs permanently in the browser's IndexedDB.
 * Files persist across browser restarts and are only deleted explicitly.
 */

import type { StorageAdapter, UploadResult } from './types';

const DB_NAME = 'iamt-storage';
const DB_VERSION = 1;
const STORE_NAME = 'files';

interface StoredFile {
    id: string;
    blob: Blob;
    name: string;
    type: string;
    size: number;
    createdAt: number;
}

/**
 * Open IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

/**
 * IndexedDB Storage Adapter
 * 
 * Provides permanent file storage in the browser.
 * Note: This adapter is primarily for local storage and doesn't support
 * the private/password-protected encryption flows (use WebTorrent adapter for that).
 * 
 * @example
 * ```typescript
 * const storage = new IndexedDBStorageAdapter();
 * const { cid } = await storage.upload(file);
 * // File persists even after browser restart
 * ```
 */
export class IndexedDBStorageAdapter implements StorageAdapter {

    async upload(file: File): Promise<UploadResult> {
        const db = await openDatabase();
        const id = `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const storedFile: StoredFile = {
            id,
            blob: file,
            name: file.name,
            type: file.type,
            size: file.size,
            createdAt: Date.now(),
        };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(storedFile);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                resolve({
                    cid: id,
                    url: `indexeddb://${id}`,
                    size: file.size,
                    visibility: 'public', // IndexedDB adapter is local-only, so visibility is always public
                });
            };

            transaction.oncomplete = () => db.close();
        });
    }

    async download(cid: string): Promise<Blob> {
        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(cid);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result as StoredFile | undefined;
                if (!result) {
                    reject(new Error(`File not found: ${cid}`));
                } else {
                    resolve(result.blob);
                }
            };

            transaction.oncomplete = () => db.close();
        });
    }

    async delete(cid: string): Promise<void> {
        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(cid);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();

            transaction.oncomplete = () => db.close();
        });
    }

    async exists(cid: string): Promise<boolean> {
        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getKey(cid);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result !== undefined);

            transaction.oncomplete = () => db.close();
        });
    }

    /**
     * Get all stored files metadata
     */
    async getAllFiles(): Promise<Array<Omit<StoredFile, 'blob'> & { preview?: string }>> {
        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const files = (request.result as StoredFile[]).map((file) => ({
                    id: file.id,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    createdAt: file.createdAt,
                    preview: URL.createObjectURL(file.blob),
                }));
                resolve(files);
            };

            transaction.oncomplete = () => db.close();
        });
    }

    /**
     * Clear all stored files
     */
    async clear(): Promise<void> {
        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();

            transaction.oncomplete = () => db.close();
        });
    }
}
