export {
    getFileTypeInfo,
    isFileTypeSupported,
    isFileSizeValid,
    formatFileSize,
    getAcceptedFileTypes,
    getSupportedFormatsText,
    type FileCategory,
    type FileTypeInfo,
} from './fileTypes';

// Encryption & Security
export {
    encryptFile,
    encryptFileWithPassword,
    decryptFile,
    decryptFileWithPassword,
    generateEncryptionKey,
    exportKey,
    importKey,
    deriveKeyFromPassword,
    hashFile,
    isCryptoSupported,
    generateIV,
    generateSalt,
    arrayBufferToBase64,
    base64ToArrayBuffer,
    arrayBufferToHex,
    uint8ArrayToBase64,
    type EncryptionResult,
    type DecryptionParams,
    type PasswordEncryptionResult,
} from './crypto';

// Keyring
export {
    LocalKeyring,
    getKeyring,
    type KeyEntry,
} from './keyring';

// Logging
export {
    logger,
    LogCategory,
    type LogLevel,
    type LogEntry,
    type LogCategoryType,
} from './logger';

// Formatting utilities
export function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    
    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 4) return `${weeks}w ago`;
    if (months < 12) return `${months}mo ago`;
    return new Date(timestamp).toLocaleDateString();
}

export function truncateDid(did: string, length: number = 8): string {
    if (!did) return 'Anonymous';
    if (did.length <= length * 2) return did;
    return `${did.slice(0, length)}...${did.slice(-4)}`;
}
