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
    const rawKey = base64ToArrayBuffer(exportedKey);
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
        arrayBuffer
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
        arrayBuffer
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
        encryptedData
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
        encryptedData
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
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
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
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
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
