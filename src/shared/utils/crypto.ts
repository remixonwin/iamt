/**
 * Client-side File Encryption Module
 * 
 * Implements AES-256-GCM encryption using the Web Crypto API for
 * secure, client-side file encryption before P2P storage.
 * 
 * Key Security Principles:
 * - Encryption happens entirely client-side
 * - Keys never leave the user's device
 * - Uses authenticated encryption (GCM) for integrity
 */

export interface EncryptionResult {
    encryptedBlob: Blob;
    key: CryptoKey;
    iv: Uint8Array;
    exportedKey: string; // Base64 for local storage
}

export interface DecryptionParams {
    encryptedBlob: Blob;
    exportedKey: string; // Base64 encoded key
    iv: string; // Base64 encoded IV
}

export interface PasswordEncryptionResult {
    encryptedBlob: Blob;
    salt: string; // Base64 encoded salt for key derivation
    iv: string; // Base64 encoded IV
}

/**
 * Check if Web Crypto API is available
 */
export function isCryptoSupported(): boolean {
    return typeof crypto !== 'undefined' &&
        typeof crypto.subtle !== 'undefined';
}

/**
 * Generate a cryptographically secure random IV (12 bytes for GCM)
 */
export function generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(12));
}

/**
 * Generate a cryptographically secure salt for PBKDF2
 */
export function generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Generate a new AES-256-GCM encryption key
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true, // extractable for export/storage
        ['encrypt', 'decrypt']
    );
}

/**
 * Export a CryptoKey to Base64 string for storage
 */
export async function exportKey(key: CryptoKey): Promise<string> {
    const rawKey = await crypto.subtle.exportKey('raw', key);
    return arrayBufferToBase64(rawKey);
}

/**
 * Import a key from Base64 string
 */
export async function importKey(exportedKey: string): Promise<CryptoKey> {
    const rawKey = base64ToArrayBuffer(exportedKey) as unknown as ArrayBuffer;
    return crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM', length: 256 },
        false, // not extractable after import
        ['decrypt']
    );
}

/**
 * Derive an encryption key from a password using PBKDF2
 * 
 * @param password - User's password
 * @param salt - Salt for key derivation (store alongside encrypted data)
 * @returns CryptoKey suitable for AES-GCM encryption
 */
export async function deriveKeyFromPassword(
    password: string,
    salt: Uint8Array
): Promise<CryptoKey> {
    const encoder = new TextEncoder();

    // Import password as key material
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    // Derive AES-256 key using PBKDF2
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: new Uint8Array(salt),
            iterations: 100000, // High iteration count for security
            hash: 'SHA-256',
        },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false, // not extractable
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt a file using a randomly generated key
 * 
 * @param file - File to encrypt
 * @returns Encrypted blob and key material for storage
 */
export async function encryptFile(file: File): Promise<EncryptionResult> {
    const key = await generateEncryptionKey();
    const iv = generateIV();

    const arrayBuffer = await file.arrayBuffer();

    const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        new Uint8Array(arrayBuffer)
    );

    // Create encrypted blob (loses original mime type for security)
    const encryptedBlob = new Blob([encryptedData], {
        type: 'application/octet-stream'
    });

    const exportedKey = await exportKey(key);

    return {
        encryptedBlob,
        key,
        iv,
        exportedKey
    };
}

/**
 * Encrypt a file using a password
 * 
 * @param file - File to encrypt
 * @param password - Password for encryption
 * @returns Encrypted blob and salt/IV for decryption
 */
export async function encryptFileWithPassword(
    file: File,
    password: string
): Promise<PasswordEncryptionResult> {
    const salt = generateSalt();
    const iv = generateIV();
    const key = await deriveKeyFromPassword(password, salt);

    const arrayBuffer = await file.arrayBuffer();

    const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        new Uint8Array(arrayBuffer)
    );

    const encryptedBlob = new Blob([encryptedData], {
        type: 'application/octet-stream'
    });

    return {
        encryptedBlob,
        salt: arrayBufferToBase64(salt.buffer),
        iv: arrayBufferToBase64(iv.buffer),
    };
}

/**
 * Decrypt a file using an exported key
 * 
 * @param params - Encrypted blob, key, and IV
 * @param originalType - Original MIME type to restore
 * @returns Decrypted file blob
 */
export async function decryptFile(
    params: DecryptionParams,
    originalType?: string
): Promise<Blob> {
    const { encryptedBlob, exportedKey, iv } = params;

    const key = await importKey(exportedKey);
    const ivBytes = base64ToArrayBuffer(iv);

    const encryptedData = await encryptedBlob.arrayBuffer();

    const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(ivBytes) },
        key,
        new Uint8Array(encryptedData)
    );

    return new Blob([decryptedData], {
        type: originalType || 'application/octet-stream'
    });
}

/**
 * Decrypt a file using a password
 * 
 * @param encryptedBlob - Encrypted file blob
 * @param password - Password for decryption
 * @param salt - Base64 encoded salt used during encryption
 * @param iv - Base64 encoded IV used during encryption
 * @param originalType - Original MIME type to restore
 * @returns Decrypted file blob
 */
export async function decryptFileWithPassword(
    encryptedBlob: Blob,
    password: string,
    salt: string,
    iv: string,
    originalType?: string
): Promise<Blob> {
    const saltBytes = base64ToArrayBuffer(salt);
    const ivBytes = base64ToArrayBuffer(iv);
    const key = await deriveKeyFromPassword(password, new Uint8Array(saltBytes));

    const encryptedData = await encryptedBlob.arrayBuffer();

    const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(ivBytes) },
        key,
        new Uint8Array(encryptedData)
    );

    return new Blob([decryptedData], {
        type: originalType || 'application/octet-stream'
    });
}

/**
 * Generate a secure file hash (SHA-256) for integrity verification
 */
export async function hashFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array(arrayBuffer));
    return arrayBufferToHex(hashBuffer);
}

// ============ Utility Functions ============

/**
 * Convert ArrayBuffer to Base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Convert ArrayBuffer to hex string
 */
export function arrayBufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Convert Uint8Array to Base64 string
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
    return arrayBufferToBase64(bytes.buffer);
}

// ============ Web Worker Support ============

let cryptoWorker: Worker | null = null;
let workerMessageId = 0;
const pendingWorkerRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
}>();

/**
 * Get or create the crypto worker instance
 */
function getCryptoWorker(): Worker | null {
    if (typeof window === 'undefined') return null;
    if (typeof Worker === 'undefined') return null;

    if (!cryptoWorker) {
        try {
            // Create worker from blob to avoid bundler issues
            cryptoWorker = new Worker(
                new URL('./crypto.worker.ts', import.meta.url),
                { type: 'module' }
            );

            cryptoWorker.onmessage = (event) => {
                const { id, success, result, error } = event.data;
                const pending = pendingWorkerRequests.get(id);
                if (pending) {
                    pendingWorkerRequests.delete(id);
                    if (success) {
                        pending.resolve(result);
                    } else {
                        pending.reject(new Error(error));
                    }
                }
            };

            cryptoWorker.onerror = (error) => {
                console.error('[CryptoWorker] Error:', error);
            };
        } catch (err) {
            console.warn('[CryptoWorker] Failed to create worker:', err);
            return null;
        }
    }

    return cryptoWorker;
}

/**
 * Send a message to the crypto worker and wait for response
 */
function workerRequest<T>(type: string, payload: unknown, transfer: Transferable[] = []): Promise<T> {
    return new Promise((resolve, reject) => {
        const worker = getCryptoWorker();
        if (!worker) {
            reject(new Error('Web Worker not available'));
            return;
        }

        const id = `msg_${++workerMessageId}`;
        pendingWorkerRequests.set(id, { resolve: resolve as (value: unknown) => void, reject });

        worker.postMessage({ id, type, payload }, transfer);
    });
}

/**
 * Check if Web Worker crypto is available
 */
export function isWorkerCryptoAvailable(): boolean {
    return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

/**
 * Encrypt a file using a Web Worker (non-blocking)
 * Falls back to main thread if worker unavailable
 */
export async function encryptFileAsync(file: File): Promise<EncryptionResult> {
    const worker = getCryptoWorker();

    if (!worker) {
        // Fallback to main thread
        return encryptFile(file);
    }

    const fileData = await file.arrayBuffer();

    const result = await workerRequest<{
        encryptedData: ArrayBuffer;
        exportedKey: string;
        iv: string;
    }>('encrypt', { fileData }, [fileData]);

    const encryptedBlob = new Blob([result.encryptedData], {
        type: 'application/octet-stream'
    });

    // Create a non-extractable key for the result (worker already exported it)
    const key = await importKey(result.exportedKey);

    return {
        encryptedBlob,
        key: key as CryptoKey, // Cast since we need extractable for type, but it's stored via exportedKey
        iv: base64ToArrayBuffer(result.iv),
        exportedKey: result.exportedKey,
    };
}

/**
 * Encrypt a file with password using a Web Worker (non-blocking)
 */
export async function encryptFileWithPasswordAsync(
    file: File,
    password: string
): Promise<PasswordEncryptionResult> {
    const worker = getCryptoWorker();

    if (!worker) {
        return encryptFileWithPassword(file, password);
    }

    const fileData = await file.arrayBuffer();

    const result = await workerRequest<{
        encryptedData: ArrayBuffer;
        salt: string;
        iv: string;
    }>('encryptWithPassword', { fileData, password }, [fileData]);

    const encryptedBlob = new Blob([result.encryptedData], {
        type: 'application/octet-stream'
    });

    return {
        encryptedBlob,
        salt: result.salt,
        iv: result.iv,
    };
}

/**
 * Decrypt a file using a Web Worker (non-blocking)
 */
export async function decryptFileAsync(
    params: DecryptionParams,
    originalType?: string
): Promise<Blob> {
    const worker = getCryptoWorker();

    if (!worker) {
        return decryptFile(params, originalType);
    }

    const encryptedData = await params.encryptedBlob.arrayBuffer();

    const result = await workerRequest<{
        decryptedData: ArrayBuffer;
    }>('decrypt', {
        encryptedData,
        exportedKey: params.exportedKey,
        iv: params.iv,
    }, [encryptedData]);

    return new Blob([result.decryptedData], {
        type: originalType || 'application/octet-stream'
    });
}

/**
 * Decrypt a file with password using a Web Worker (non-blocking)
 */
export async function decryptFileWithPasswordAsync(
    encryptedBlob: Blob,
    password: string,
    salt: string,
    iv: string,
    originalType?: string
): Promise<Blob> {
    const worker = getCryptoWorker();

    if (!worker) {
        return decryptFileWithPassword(encryptedBlob, password, salt, iv, originalType);
    }

    const encryptedData = await encryptedBlob.arrayBuffer();

    const result = await workerRequest<{
        decryptedData: ArrayBuffer;
    }>('decryptWithPassword', {
        encryptedData,
        password,
        salt,
        iv,
    }, [encryptedData]);

    return new Blob([result.decryptedData], {
        type: originalType || 'application/octet-stream'
    });
}

/**
 * Terminate the crypto worker (for cleanup)
 */
export function terminateCryptoWorker(): void {
    if (cryptoWorker) {
        cryptoWorker.terminate();
        cryptoWorker = null;
        pendingWorkerRequests.clear();
    }
}

// ============ Blinded Hash Utilities for Deduplication ============

const USER_SECRET_KEY = 'iamt-user-dedup-secret';

/**
 * Get or create a user-specific secret for blinding content hashes.
 * This secret ensures each user's blinded hashes are unique, preventing
 * cross-user correlation attacks on the server.
 */
export async function getUserSecret(): Promise<string> {
    if (typeof window === 'undefined') {
        // Server-side: return a placeholder (should not be used)
        return 'server-placeholder';
    }

    // Check localStorage for existing secret
    let secret = localStorage.getItem(USER_SECRET_KEY);
    
    if (!secret) {
        // Generate a new 256-bit random secret
        const randomBytes = crypto.getRandomValues(new Uint8Array(32));
        secret = arrayBufferToHex(randomBytes.buffer);
        localStorage.setItem(USER_SECRET_KEY, secret);
        console.log('[Crypto] Generated new user dedup secret');
    }

    return secret;
}

/**
 * Compute a blinded hash for privacy-preserving server queries.
 * 
 * BlindedHash = SHA-256(contentHash + userSecret)
 * 
 * This prevents the server from:
 * - Learning the actual content hash
 * - Correlating files across different users
 * - Building a rainbow table of known content hashes
 * 
 * @param contentHash - SHA-256 hash of the original file content
 * @param userSecret - User-specific secret (from getUserSecret())
 * @returns Hex-encoded blinded hash
 */
export async function computeBlindedHash(
    contentHash: string,
    userSecret: string
): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(contentHash + userSecret);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return arrayBufferToHex(hashBuffer);
}

/**
 * Compute a password-blinded hash for password-protected file deduplication.
 * 
 * BlindedHash = SHA-256(contentHash + password)
 * 
 * This enables deduplication across users sharing the same file with the same password,
 * while different passwords produce different hashes (no dedup = separate storage).
 * 
 * @param contentHash - SHA-256 hash of the original file content
 * @param password - Password used for encryption
 * @returns Hex-encoded password-blinded hash
 */
export async function computePasswordBlindedHash(
    contentHash: string,
    password: string
): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(contentHash + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return arrayBufferToHex(hashBuffer);
}
