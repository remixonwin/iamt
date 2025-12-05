/**
 * Storage Adapter Interface
 * 
 * Provides a unified interface for file storage operations.
 * Implementations can target IPFS (Pinata, Web3.Storage), Arweave, or local storage.
 * 
 * @example
 * ```typescript
 * const storage = new IpfsStorageAdapter();
 * const { cid, url } = await storage.upload(file);
 * ```
 */
export interface StorageAdapter {
    /**
     * Upload a file to storage
     * @param file - The file to upload
     * @returns Promise with content identifier and accessible URL
     */
    upload(file: File): Promise<UploadResult>;

    /**
     * Download a file from storage by its identifier
     * @param cid - Content identifier (e.g., IPFS CID)
     * @returns Promise with file blob
     */
    download(cid: string): Promise<Blob>;

    /**
     * Delete a file from storage (if supported)
     * @param cid - Content identifier
     */
    delete(cid: string): Promise<void>;

    /**
     * Check if a file exists in storage
     * @param cid - Content identifier
     */
    exists(cid: string): Promise<boolean>;
}

export interface UploadResult {
    /** Content identifier (IPFS CID, Arweave TX ID, etc.) */
    cid: string;
    /** Publicly accessible URL */
    url: string;
    /** File size in bytes */
    size: number;
}
