import type { StorageAdapter, UploadResult, UploadOptions, FileVisibility } from './types';
import { seedFile, downloadFileP2P } from './p2p';
import {
    encryptFile,
    encryptFileWithPassword,
    uint8ArrayToBase64,
    isCryptoSupported,
    hashFile,
    getUserSecret,
    computeBlindedHash,
    computePasswordBlindedHash
} from '@/shared/utils/crypto';
import { getKeyring } from '@/shared/utils/keyring';
import { getContentIndex, type ContentIndexEntry } from '@/shared/lib/dedup/contentIndex';

// Storage server URL (localtunnel exposed)
const STORAGE_API = process.env.NEXT_PUBLIC_STORAGE_API || 'http://localhost:3001';

// Check if we're in production without a configured storage API
const isProductionWithoutStorage = typeof window !== 'undefined'
    && !window.location.hostname.includes('localhost')
    && STORAGE_API.includes('localhost');

/**
 * WebTorrent Storage Adapter
 * 
 * Hybrid Architecture:
 * 1. Seeds via Browser WebRTC (P2P)
 * 2. Uploads to Server (HTTP) for reliability/pinning (if available)
 * 
 * Security Features:
 * - Client-side encryption for private files
 * - Password protection option
 * - Keys stored locally, never transmitted
 */
export class WebTorrentStorageAdapter implements StorageAdapter {
    private apiUrl: string;
    private serverAvailable: boolean;

    constructor(apiUrl?: string) {
        this.apiUrl = apiUrl || STORAGE_API;
        this.serverAvailable = true; // Always attempt connection, let network stack handle failures
    }

    private sanitizeFilename(name: string): string {
        return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
    }

    /**
     * Upload file: Hybrid Strategy with Encryption and Deduplication
     * 
     * Deduplication Strategy:
     * 1. Hash original file content (SHA-256)
     * 2. Check local content index for existing upload
     * 3. For public/password files: query server with blinded hash
     * 4. If exists: reuse storage ID, increment refCount
     * 5. If new: upload normally, store in content index
     * 
     * Privacy:
     * - Private files: local-only dedup (no server queries)
     * - Public files: blinded hash = SHA-256(contentHash + userSecret)
     * - Password files: blinded hash = SHA-256(contentHash + password)
     */
    async upload(file: File, options?: UploadOptions): Promise<UploadResult> {
        const visibility: FileVisibility = options?.visibility || 'public';
        let fileToUpload = file;
        let encryptionIv: string | undefined;
        let encryptionSalt: string | undefined;
        let exportedKey: string | undefined;
        const originalType = file.type;
        const originalName = file.name;

        // Step 1: Compute content hash of original file BEFORE encryption
        const contentHash = await hashFile(file);
        console.log('[Adapter] Content hash:', contentHash.slice(0, 16) + '...');

        // Step 2: Compute blinded hash based on visibility
        let blindedHash: string;
        if (visibility === 'password-protected' && options?.password) {
            // Password-blinded: same file + same password = same hash
            blindedHash = await computePasswordBlindedHash(contentHash, options.password);
        } else {
            // User-blinded: unique per user
            const userSecret = await getUserSecret();
            blindedHash = await computeBlindedHash(contentHash, userSecret);
        }
        console.log('[Adapter] Blinded hash:', blindedHash.slice(0, 16) + '...');

        // Step 3: Check local content index for existing upload
        const contentIndex = getContentIndex();
        const existingEntry = await contentIndex.lookup(contentHash);

        if (existingEntry) {
            console.log('[Adapter] Dedup hit (local): reusing storage ID', existingEntry.storageId);
            await contentIndex.incrementRefCount(contentHash);

            // For private files, we still need to store the new key reference
            if (visibility === 'private' && isCryptoSupported()) {
                // Re-encrypt with a new key for this "instance"
                // Note: This means private files don't actually dedup storage,
                // but we track them for refCount purposes
            }

            return {
                cid: existingEntry.storageId,
                url: '',
                size: existingEntry.size,
                visibility,
                contentHash,
                deduplicated: true,
            };
        }

        // Step 4: For public/password files, check server with blinded hash
        // Skip for private files to avoid timing attacks
        if (visibility !== 'private' && this.serverAvailable && !isProductionWithoutStorage) {
            try {
                const response = await fetch(`${this.apiUrl}/check-hash/${blindedHash}`);
                if (response.ok) {
                    const { exists, infoHash } = await response.json();
                    if (exists && infoHash) {
                        console.log('[Adapter] Dedup hit (server): reusing storage ID', infoHash);

                        // Store in local content index
                        const entry: ContentIndexEntry = {
                            contentHash,
                            storageId: infoHash,
                            blindedHash,
                            visibility,
                            refCount: 1,
                            size: file.size,
                            createdAt: Date.now(),
                            lastAccessedAt: Date.now(),
                        };
                        await contentIndex.store(entry);

                        return {
                            cid: infoHash,
                            url: '',
                            size: file.size,
                            visibility,
                            contentHash,
                            deduplicated: true,
                        };
                    }
                }
            } catch (err) {
                console.warn('[Adapter] Server dedup check failed:', err);
                // Continue with normal upload
            }
        }

        // Step 5: No dedup match - proceed with upload
        // Ensure filename matches what server will produce (for consistent InfoHash)

        // Handle encryption for private/password-protected files
        if (visibility !== 'public' && isCryptoSupported()) {
            console.log('[Adapter] Encrypting file for', visibility, 'visibility');

            if (visibility === 'password-protected' && options?.password) {
                // Password-protected encryption
                const result = await encryptFileWithPassword(file, options.password);
                const sanitizedName = this.sanitizeFilename(`${file.name}.encrypted`);
                fileToUpload = new File([result.encryptedBlob], sanitizedName, {
                    type: 'application/octet-stream',
                });
                encryptionIv = result.iv;
                encryptionSalt = result.salt;
            } else {
                // Private encryption (random key stored locally)
                const result = await encryptFile(file);
                const sanitizedName = this.sanitizeFilename(`${file.name}.encrypted`);
                fileToUpload = new File([result.encryptedBlob], sanitizedName, {
                    type: 'application/octet-stream',
                });
                encryptionIv = uint8ArrayToBase64(result.iv);
                exportedKey = result.exportedKey; // Save the key from THIS encryption

                // Key will be stored after we get the CID
            }
        } else {
            // Public file: Sanitize name to match server
            const sanitizedName = this.sanitizeFilename(file.name);
            if (sanitizedName !== file.name) {
                fileToUpload = new File([file], sanitizedName, { type: file.type });
            }
        }

        // 1. Start Browser Seeding (P2P)
        let magnetURI: string | undefined;
        let infoHash: string | undefined;
        try {
            magnetURI = await seedFile(fileToUpload);
            // Extract infoHash from magnetURI
            const match = magnetURI.match(/btih:([a-fA-F0-9]+)/);
            infoHash = match ? match[1].toLowerCase() : undefined;
            console.log('[Adapter] Browser seeding started:', magnetURI);
        } catch (err) {
            console.warn('[Adapter] P2P Seeding failed:', err);
            if (!this.serverAvailable) {
                throw new Error('P2P seeding failed and no storage server available. Please try again.');
            }
        }

        let cid: string;
        let serverResult: { infoHash: string; size: number; magnetURI?: string } | null = null;

        // 2. Upload to Server (Pinning) - only if server is available and NOT in production without storage
        if (this.serverAvailable && !isProductionWithoutStorage) {
            try {
                const formData = new FormData();
                formData.append('file', fileToUpload);

                const response = await fetch(`${this.apiUrl}/upload`, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const error = await response.text();
                    console.warn('[Adapter] Server upload failed:', error);
                    // Don't throw if P2P succeeded
                    if (!infoHash) {
                        throw new Error(`Upload failed: ${error}`);
                    }
                } else {
                    serverResult = await response.json();
                }
            } catch (err) {
                console.warn('[Adapter] Server upload error (P2P-only mode will be used):', err);
                // Continue with P2P-only if we have infoHash
                if (!infoHash) {
                    throw err;
                }
            }
        } else if (isProductionWithoutStorage) {
            console.log('[Adapter] Production mode: Skipping server upload, using P2P-only');
        }

        // Use server infoHash if available, otherwise use P2P infoHash
        cid = serverResult?.infoHash || infoHash!;

        if (!cid) {
            throw new Error('Failed to get file identifier from P2P or server');
        }

        // Store encryption key in local keyring for private files
        if (visibility === 'private' && isCryptoSupported() && exportedKey && encryptionIv) {
            const keyring = getKeyring();
            await keyring.storeKey(
                cid,
                exportedKey,
                encryptionIv,
                originalName,
                originalType
            );
            console.log('[Adapter] Encryption key stored in keyring for:', cid);
        }

        // Store password-protected metadata
        if (visibility === 'password-protected' && encryptionSalt && encryptionIv) {
            const keyring = getKeyring();
            await keyring.storePasswordProtectedMeta(
                cid,
                encryptionSalt,
                encryptionIv,
                originalName,
                originalType
            );
        }

        // Step 6: Store in content index for future deduplication
        const newEntry: ContentIndexEntry = {
            contentHash,
            storageId: cid,
            blindedHash,
            visibility,
            refCount: 1,
            size: file.size,
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
        };
        await contentIndex.store(newEntry);
        console.log('[Adapter] Stored in content index:', contentHash.slice(0, 16) + '...');

        // Step 7: Register blinded hash with server for cross-session dedup
        // Only for public/password files (private files are local-only)
        if (visibility !== 'private' && this.serverAvailable && !isProductionWithoutStorage) {
            try {
                await fetch(`${this.apiUrl}/register-hash`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ blindedHash, infoHash: cid }),
                });
                console.log('[Adapter] Registered blinded hash with server');
            } catch (err) {
                console.warn('[Adapter] Failed to register blinded hash:', err);
                // Non-fatal: local dedup still works
            }
        }

        return {
            cid,
            url: magnetURI || serverResult?.magnetURI || '',
            size: serverResult?.size || fileToUpload.size,
            visibility,
            contentHash,
            encryptionMetadata: visibility !== 'public' ? {
                iv: encryptionIv!,
                salt: encryptionSalt,
                originalType,
                originalName,
            } : undefined,
        };
    }

    /**
     * Download file: Hybrid Strategy
     * Download file: P2P First, Server Fallback (if available)
     */
    async download(cid: string): Promise<Blob> {
        // Legacy IPFS fallback
        if (cid.startsWith('Qm') || cid.startsWith('bafy')) {
            const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
            if (!response.ok) throw new Error(`IPFS Download failed: ${cid}`);
            return response.blob();
        }

        // Try P2P First
        // Construct magnet URI from infoHash
        const magnetURI = `magnet:?xt=urn:btih:${cid}&dn=${cid}&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.webtorrent.dev&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337`;

        try {
            console.log('[Adapter] Attempting P2P download...');
            return await downloadFileP2P(magnetURI);
        } catch (err) {
            console.warn('[Adapter] P2P download failed/timeout:', err);

            // If in production without server OR no server available, P2P was our only option
            if (isProductionWithoutStorage || !this.serverAvailable) {
                throw new Error('P2P download failed. The file may not be seeded by any peers. Please ensure the original uploader has the page open.');
            }
        }

        // Fallback to Server HTTP (only if server is available and NOT in production without storage)
        console.log('[Adapter] Falling back to Server HTTP...');
        const response = await fetch(`${this.apiUrl}/download/${cid}`);

        if (!response.ok) {
            throw new Error(`Download failed: ${cid}`);
        }

        return response.blob();
    }

    /**
     * Download and decrypt a private file
     * Uses the key from local keyring
     */
    async downloadAndDecrypt(cid: string, userDid?: string): Promise<Blob> {
        const { decryptFile, isCryptoSupported } = await import('@/shared/utils/crypto');

        if (!isCryptoSupported()) {
            throw new Error('Encryption not supported in this browser');
        }

        const keyring = getKeyring();
        const keyEntry = await keyring.getKey(cid, userDid);

        if (!keyEntry) {
            throw new Error('No encryption key found for this file. You may not be the owner.');
        }

        if (keyEntry.isPasswordProtected) {
            throw new Error('This file is password-protected. Use downloadWithPassword() instead.');
        }



        // Download encrypted blob
        const encryptedBlob = await this.download(cid);

        console.log(`[Adapter] Downloaded blob size: ${encryptedBlob.size} bytes for CID: ${cid}`);

        // Log first few bytes to check if it's not HTML/text error
        try {
            const header = await encryptedBlob.slice(0, 16).arrayBuffer();
            console.log('[Adapter] First 16 bytes:', new Uint8Array(header));
        } catch (e) {
            console.warn('[Adapter] Failed to inspect blob');
        }

        // Decrypt
        try {
            const decryptedBlob = await decryptFile(
                {
                    encryptedBlob,
                    exportedKey: keyEntry.key,
                    iv: keyEntry.iv,
                },
                keyEntry.mimeType
            );

            console.log('[Adapter] File decrypted successfully:', cid);
            return decryptedBlob;
        } catch (error) {
            console.error(`[Adapter] Decryption failed for ${cid}. Blob size: ${encryptedBlob.size}, Key found: ${!!keyEntry.key}, IV present: ${!!keyEntry.iv}`);
            throw error;
        }
    }

    /**
     * Download and decrypt a password-protected file
     */
    async downloadWithPassword(cid: string, password: string, userDid?: string): Promise<Blob> {
        const { decryptFileWithPassword, isCryptoSupported } = await import('@/shared/utils/crypto');

        if (!isCryptoSupported()) {
            throw new Error('Encryption not supported in this browser');
        }

        const keyring = getKeyring();
        const keyEntry = await keyring.getKey(cid, userDid);

        if (!keyEntry) {
            throw new Error('No metadata found for this file.');
        }

        if (!keyEntry.isPasswordProtected || !keyEntry.salt) {
            throw new Error('This file is not password-protected.');
        }

        // Download encrypted blob
        const encryptedBlob = await this.download(cid);

        // Decrypt with password
        const decryptedBlob = await decryptFileWithPassword(
            encryptedBlob,
            password,
            keyEntry.salt,
            keyEntry.iv,
            keyEntry.mimeType
        );

        console.log('[Adapter] Password-protected file decrypted successfully:', cid);
        return decryptedBlob;
    }

    /**
     * Check if we can decrypt a file (have the key)
     */
    async canDecrypt(cid: string): Promise<boolean> {
        const keyring = getKeyring();
        return keyring.hasKey(cid);
    }

    /**
     * Delete file from storage server with reference counting
     * 
     * Only deletes from storage when refCount reaches 0.
     * This preserves deduplicated content for other references.
     * 
     * @param cid - Storage ID (InfoHash)
     * @param contentHash - Optional content hash for refCount tracking
     */
    async delete(cid: string, contentHash?: string): Promise<void> {
        const contentIndex = getContentIndex();
        
        // If we have the content hash, use reference counting
        if (contentHash) {
            const refCount = await contentIndex.decrementRefCount(contentHash);
            console.log('[Adapter] RefCount after delete:', refCount, 'for:', contentHash.slice(0, 16) + '...');
            
            if (refCount > 0) {
                console.log('[Adapter] Skipping storage deletion - other references exist');
                // Still remove the key from keyring for this user
                const keyring = getKeyring();
                try {
                    await keyring.deleteKey(cid);
                } catch {
                    // Key might not exist, that's ok
                }
                return;
            }
        } else {
            // Try to find content hash by storage ID
            const entry = await contentIndex.lookupByStorageId(cid);
            if (entry) {
                const refCount = await contentIndex.decrementRefCount(entry.contentHash);
                console.log('[Adapter] RefCount after delete:', refCount, 'for:', entry.contentHash.slice(0, 16) + '...');
                
                if (refCount > 0) {
                    console.log('[Adapter] Skipping storage deletion - other references exist');
                    const keyring = getKeyring();
                    try {
                        await keyring.deleteKey(cid);
                    } catch {
                        // Key might not exist, that's ok
                    }
                    return;
                }
            }
        }

        // RefCount is 0 or not tracked - proceed with actual storage deletion
        try {
            const response = await fetch(`${this.apiUrl}/file/${cid}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                console.warn('[Adapter] Server delete failed:', cid);
                // Don't throw - local cleanup should still proceed
            } else {
                console.log('[Adapter] Deleted from storage server:', cid);
            }
        } catch (err) {
            console.warn('[Adapter] Delete request failed:', err);
            // Continue with local cleanup
        }

        // Remove key from keyring
        const keyring = getKeyring();
        try {
            await keyring.deleteKey(cid);
        } catch {
            // Key might not exist, that's ok
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
