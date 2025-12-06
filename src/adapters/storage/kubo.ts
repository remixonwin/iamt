/**
 * Kubo IPFS Storage Adapter
 * 
 * Self-hosted IPFS storage using Kubo (go-ipfs).
 * Fully open-source, no third-party dependencies.
 * Files are accessible globally via IPFS CID.
 */

import type { StorageAdapter, UploadResult } from './types';

// Default to local Kubo node, configurable via environment
const KUBO_API_URL = typeof process !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_KUBO_API || 'http://localhost:5001')
    : 'http://localhost:5001';
const KUBO_GATEWAY_URL = typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_KUBO_GATEWAY || 'http://localhost:8080')
    : 'http://localhost:8080';

/**
 * Kubo IPFS Storage Adapter
 * 
 * Uploads files to a self-hosted IPFS node (Kubo/go-ipfs).
 * Fully decentralized, open-source alternative to Pinata.
 * 
 * @example
 * ```typescript
 * const storage = new KuboStorageAdapter();
 * const { cid, url } = await storage.upload(file);
 * // File is now on IPFS, accessible from any device!
 * ```
 */
export class KuboStorageAdapter implements StorageAdapter {
    private apiUrl: string;
    private gatewayUrl: string;

    constructor(apiUrl?: string, gatewayUrl?: string) {
        this.apiUrl = apiUrl || KUBO_API_URL;
        this.gatewayUrl = gatewayUrl || KUBO_GATEWAY_URL;
    }

    /**
     * Upload a file to IPFS via Kubo API
     * Uses the /api/v0/add endpoint
     */
    async upload(file: File): Promise<UploadResult> {
        const formData = new FormData();
        formData.append('file', file, file.name);

        // Kubo API v0 add endpoint
        const response = await fetch(`${this.apiUrl}/api/v0/add?pin=true&cid-version=1`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Kubo upload failed: ${error}`);
        }

        // Kubo returns NDJSON, parse the last line for the file
        const text = await response.text();
        const lines = text.trim().split('\n');
        const result = JSON.parse(lines[lines.length - 1]);
        const cid = result.Hash;

        return {
            cid,
            url: `${this.gatewayUrl}/ipfs/${cid}`,
            size: file.size,
            visibility: 'public', // IPFS files are publicly accessible by CID
        };
    }

    /**
     * Download a file from IPFS by CID
     * Tries local gateway first, falls back to public gateways
     */
    async download(cid: string): Promise<Blob> {
        // Try local gateway first
        try {
            const response = await fetch(`${this.gatewayUrl}/ipfs/${cid}`);
            if (response.ok) {
                return response.blob();
            }
        } catch {
            // Fall through to public gateways
        }

        // Fallback to public IPFS gateways (all open-source/community-run)
        const publicGateways = [
            `https://dweb.link/ipfs/${cid}`,
            `https://ipfs.io/ipfs/${cid}`,
            `https://cloudflare-ipfs.com/ipfs/${cid}`,
        ];

        for (const gatewayUrl of publicGateways) {
            try {
                const response = await fetch(gatewayUrl);
                if (response.ok) {
                    return response.blob();
                }
            } catch {
                continue;
            }
        }

        throw new Error(`Failed to download from IPFS: ${cid}`);
    }

    /**
     * Unpin a file from local Kubo node
     * Note: This doesn't remove it from the global IPFS network
     */
    async delete(cid: string): Promise<void> {
        const response = await fetch(`${this.apiUrl}/api/v0/pin/rm?arg=${cid}`, {
            method: 'POST',
        });

        if (!response.ok) {
            const error = await response.text();
            // Ignore "not pinned" errors
            if (!error.includes('not pinned')) {
                throw new Error(`Kubo unpin failed: ${error}`);
            }
        }

        // Optionally run garbage collection
        try {
            await fetch(`${this.apiUrl}/api/v0/repo/gc`, { method: 'POST' });
        } catch {
            // GC is optional, don't fail if it errors
        }
    }

    /**
     * Check if a file exists on IPFS (pinned locally or accessible)
     */
    async exists(cid: string): Promise<boolean> {
        // Check if pinned locally first
        try {
            const response = await fetch(`${this.apiUrl}/api/v0/pin/ls?arg=${cid}`, {
                method: 'POST',
            });
            if (response.ok) {
                const result = await response.json();
                if (result.Keys && result.Keys[cid]) {
                    return true;
                }
            }
        } catch {
            // Not pinned locally, check gateway
        }

        // Check if accessible via gateway
        try {
            const response = await fetch(`${this.gatewayUrl}/ipfs/${cid}`, {
                method: 'HEAD',
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Pin an existing CID to ensure it stays on this node
     */
    async pin(cid: string): Promise<void> {
        const response = await fetch(`${this.apiUrl}/api/v0/pin/add?arg=${cid}`, {
            method: 'POST',
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Kubo pin failed: ${error}`);
        }
    }

    /**
     * Get IPFS node info (version, peers, etc.)
     */
    async getNodeInfo(): Promise<{ id: string; agentVersion: string; peers: number }> {
        const [idRes, peersRes] = await Promise.all([
            fetch(`${this.apiUrl}/api/v0/id`, { method: 'POST' }),
            fetch(`${this.apiUrl}/api/v0/swarm/peers`, { method: 'POST' }),
        ]);

        if (!idRes.ok) {
            throw new Error('Failed to get node info');
        }

        const idData = await idRes.json();
        let peerCount = 0;

        if (peersRes.ok) {
            const peersData = await peersRes.json();
            peerCount = peersData.Peers?.length || 0;
        }

        return {
            id: idData.ID,
            agentVersion: idData.AgentVersion,
            peers: peerCount,
        };
    }
}
