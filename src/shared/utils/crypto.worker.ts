/**
 * Crypto Web Worker
 * 
 * Offloads encryption/decryption operations to a background thread
 * to prevent UI blocking during large file operations.
 * 
 * Supports:
 * - File encryption with random key
 * - File encryption with password
 * - File decryption with key
 * - File decryption with password
 */

interface WorkerMessage {
    id: string;
    type: 'encrypt' | 'encryptWithPassword' | 'decrypt' | 'decryptWithPassword';
    payload: unknown;
}

interface EncryptPayload {
    fileData: ArrayBuffer;
}

interface EncryptWithPasswordPayload {
    fileData: ArrayBuffer;
    password: string;
}

interface DecryptPayload {
    encryptedData: ArrayBuffer;
    exportedKey: string;
    iv: string;
}

interface DecryptWithPasswordPayload {
    encryptedData: ArrayBuffer;
    password: string;
    salt: string;
    iv: string;
}

// ============ Utility Functions ============

function arrayBufferToBase64(buffer: ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(12));
}

function generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
}

async function generateEncryptionKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

async function exportKey(key: CryptoKey): Promise<string> {
    const rawKey = await crypto.subtle.exportKey('raw', key);
    return arrayBufferToBase64(rawKey);
}

async function importKey(exportedKey: string): Promise<CryptoKey> {
    const rawKey = base64ToArrayBuffer(exportedKey);
    return crypto.subtle.importKey(
        'raw',
        rawKey.buffer as ArrayBuffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );
}

async function deriveKeyFromPassword(
    password: string,
    salt: Uint8Array
): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: new Uint8Array(salt),
            iterations: 100000,
            hash: 'SHA-256',
        },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

// ============ Worker Handlers ============

async function handleEncrypt(payload: EncryptPayload) {
    const key = await generateEncryptionKey();
    const iv = generateIV();

    const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        new Uint8Array(payload.fileData)
    );

    const exportedKey = await exportKey(key);

    return {
        encryptedData,
        exportedKey,
        iv: arrayBufferToBase64(iv.buffer),
    };
}

async function handleEncryptWithPassword(payload: EncryptWithPasswordPayload) {
    const salt = generateSalt();
    const iv = generateIV();
    const key = await deriveKeyFromPassword(payload.password, salt);

    const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        new Uint8Array(payload.fileData)
    );

    return {
        encryptedData,
        salt: arrayBufferToBase64(salt.buffer),
        iv: arrayBufferToBase64(iv.buffer),
    };
}

async function handleDecrypt(payload: DecryptPayload) {
    const key = await importKey(payload.exportedKey);
    const ivBytes = base64ToArrayBuffer(payload.iv);

    const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(ivBytes) },
        key,
        new Uint8Array(payload.encryptedData)
    );

    return { decryptedData };
}

async function handleDecryptWithPassword(payload: DecryptWithPasswordPayload) {
    const saltBytes = base64ToArrayBuffer(payload.salt);
    const ivBytes = base64ToArrayBuffer(payload.iv);
    const key = await deriveKeyFromPassword(payload.password, new Uint8Array(saltBytes));

    const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(ivBytes) },
        key,
        new Uint8Array(payload.encryptedData)
    );

    return { decryptedData };
}

// ============ Message Handler ============

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const { id, type, payload } = event.data;

    try {
        let result;

        switch (type) {
            case 'encrypt':
                result = await handleEncrypt(payload as EncryptPayload);
                self.postMessage(
                    { id, success: true, result },
                    { transfer: [result.encryptedData] }
                );
                break;

            case 'encryptWithPassword':
                result = await handleEncryptWithPassword(payload as EncryptWithPasswordPayload);
                self.postMessage(
                    { id, success: true, result },
                    { transfer: [result.encryptedData] }
                );
                break;

            case 'decrypt':
                result = await handleDecrypt(payload as DecryptPayload);
                self.postMessage(
                    { id, success: true, result },
                    { transfer: [result.decryptedData] }
                );
                break;

            case 'decryptWithPassword':
                result = await handleDecryptWithPassword(payload as DecryptWithPasswordPayload);
                self.postMessage(
                    { id, success: true, result },
                    { transfer: [result.decryptedData] }
                );
                break;

            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        self.postMessage({
            id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

export {};
