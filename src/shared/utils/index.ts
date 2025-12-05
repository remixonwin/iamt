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

// Encryption utilities
export {
    encryptFile,
    decryptFile,
    encryptFileWithPassword,
    decryptFileWithPassword,
    generateEncryptionKey,
    exportKey,
    importKey,
    hashFile,
    isCryptoSupported,
    arrayBufferToBase64,
    base64ToArrayBuffer,
    uint8ArrayToBase64,
    type EncryptionResult,
    type DecryptionParams,
    type PasswordEncryptionResult,
} from './crypto';

// Local keyring for encryption keys
export {
    LocalKeyring,
    getKeyring,
    type KeyEntry,
} from './keyring';
