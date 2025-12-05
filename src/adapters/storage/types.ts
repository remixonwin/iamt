/**
 * File Visibility Options
 * 
 * - public: Anyone with the CID can access the file
 * - private: File is encrypted, only owner can decrypt
 * - password-protected: File is encrypted, anyone with password can decrypt
 */
export type FileVisibility = 'public' | 'private' | 'password-protected';

/**
 * Upload Options
 */
export interface UploadOptions {
    /** File visibility setting */
    visibility: FileVisibility;
    /** Password for password-protected files */
    password?: string;
}

/**
 * Encryption Metadata
 * Stored alongside the file for decryption
 */
export interface EncryptionMetadata {
    /** Base64 encoded initialization vector */
    iv: string;
    /** Base64 encoded salt (for password-protected files) */
    salt?: string;
    /** Original MIME type before encryption */
    originalType: string;
    /** Original file name */
    originalName: string;
}

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
     * @param options - Upload options including visibility
     * @returns Promise with content identifier and accessible URL
     */
    upload(file: File, options?: UploadOptions): Promise<UploadResult>;

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
    /** File visibility setting */
    visibility: FileVisibility;
    /** Encryption metadata (for private/password-protected files) */
    encryptionMetadata?: EncryptionMetadata;
}
