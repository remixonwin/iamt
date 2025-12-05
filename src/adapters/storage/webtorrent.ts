/**
 * WebTorrent Storage Adapter
 * 
 * Uploads files to local WebTorrent server and returns magnet URIs
 * for P2P download across devices.
 */

import type { StorageAdapter, UploadResult } from './types';

// Storage server URL (localtunnel exposed)
const STORAGE_API = process.env.NEXT_PUBLIC_STORAGE_API || 'http://localhost:3001';

/**
 * WebTorrent Storage Adapter
 * 
 * Stores files locally and shares via torrent magnet links.
 * 
 * @example
 * ```typescript
 * const storage = new WebTorrentStorageAdapter();
 * const { cid, url } = await storage.upload(file);
 * // cid is the torrent info hash
 * // url is the magnet URI for P2P download
 * ```
 */
export class WebTorrentStorageAdapter implements StorageAdapter {
    private apiUrl: string;

    constructor(apiUrl?: string) {
        this.apiUrl = apiUrl || STORAGE_API;
    }

    /**
     * Upload file to WebTorrent storage server
     * Returns torrent info hash and magnet URI
     */
    async upload(file: File): Promise<UploadResult> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.apiUrl}/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Upload failed: ${error}`);
        }

        const result = await response.json();

        return {
            cid: result.infoHash,
            url: result.magnetURI,
            size: result.size,
        };
    }

    /**
     * Download file via HTTP fallback
     * (For direct download when P2P not available)
     */
    async download(cid: string): Promise<Blob> {
        const response = await fetch(`${this.apiUrl}/download/${cid}`);

        if (!response.ok) {
            throw new Error(`Download failed: ${cid}`);
        }

        return response.blob();
    }

    /**
     * Delete file from storage server
     */
    async delete(cid: string): Promise<void> {
        const response = await fetch(`${this.apiUrl}/file/${cid}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error(`Delete failed: ${cid}`);
        }
    }

    /**
     * Check if file exists
     */
    async exists(cid: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.apiUrl}/file/${cid}`);
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get all files from storage
     */
    async getAllFiles(): Promise<Array<{
        id: string;
        name: string;
        size: number;
        magnetURI: string;
        peers: number;
    }>> {
        const response = await fetch(`${this.apiUrl}/files`);

        if (!response.ok) {
            return [];
        }

        const { files } = await response.json();
        return files;
    }
}
