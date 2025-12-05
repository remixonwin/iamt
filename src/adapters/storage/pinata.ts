/**
 * Pinata IPFS Storage Adapter
 * 
 * Uploads files to IPFS via Pinata for true cross-device file sync.
 * Files are accessible globally via IPFS CID.
 */

import type { StorageAdapter, UploadResult } from './types';

const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

/**
 * Pinata IPFS Storage Adapter
 * 
 * Uploads files to IPFS and returns a globally accessible CID.
 * Any device can download files using the CID.
 * 
 * @example
 * ```typescript
 * const storage = new PinataStorageAdapter('your-jwt-token');
 * const { cid, url } = await storage.upload(file);
 * // File is now on IPFS, accessible from any device!
 * ```
 */
export class PinataStorageAdapter implements StorageAdapter {
    private jwt: string;

    constructor(jwt: string) {
        this.jwt = jwt;
    }

    /**
     * Upload a file to IPFS via Pinata
     */
    async upload(file: File): Promise<UploadResult> {
        const formData = new FormData();
        formData.append('file', file);

        // Add metadata
        const metadata = JSON.stringify({
            name: file.name,
            keyvalues: {
                app: 'iamt',
                type: file.type,
                size: file.size.toString(),
                uploadedAt: Date.now().toString(),
            },
        });
        formData.append('pinataMetadata', metadata);

        // Pin options
        const options = JSON.stringify({
            cidVersion: 1,
        });
        formData.append('pinataOptions', options);

        const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.jwt}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Pinata upload failed: ${error}`);
        }

        const result = await response.json();
        const cid = result.IpfsHash;

        return {
            cid,
            url: `${PINATA_GATEWAY}/${cid}`,
            size: file.size,
        };
    }

    /**
     * Download a file from IPFS by CID
     */
    async download(cid: string): Promise<Blob> {
        const response = await fetch(`${PINATA_GATEWAY}/${cid}`);

        if (!response.ok) {
            throw new Error(`Failed to download from IPFS: ${cid}`);
        }

        return response.blob();
    }

    /**
     * Unpin a file from Pinata (doesn't remove from IPFS network)
     */
    async delete(cid: string): Promise<void> {
        const response = await fetch(`${PINATA_API_URL}/pinning/unpin/${cid}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${this.jwt}`,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Pinata unpin failed: ${error}`);
        }
    }

    /**
     * Check if a file exists on IPFS
     */
    async exists(cid: string): Promise<boolean> {
        try {
            const response = await fetch(`${PINATA_GATEWAY}/${cid}`, {
                method: 'HEAD',
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}
