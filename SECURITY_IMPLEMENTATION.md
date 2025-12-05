# IAMT Security & Privacy Implementation Summary

## 🎯 Overview

Comprehensive security and privacy enhancements have been implemented for the decentralized P2P file storage application (IAMT). The implementation includes:

- ✅ **Client-side AES-256-GCM encryption** for private files
- ✅ **Password-protected file sharing** with PBKDF2 key derivation
- ✅ **Secure local keyring** for encryption key management
- ✅ **File visibility toggle** (Public/Private/Password-Protected)
- ✅ **Server security hardening** with rate limiting and CORS restrictions
- ✅ **Enhanced metadata** tracking privacy settings across Gun.js

---

## 📦 New Modules & Features

### 1. Encryption Utilities (`src/shared/utils/crypto.ts`)

**Core Functions:**
- `encryptFile(file)` - Encrypts a file with random AES-256-GCM key
- `encryptFileWithPassword(file, password)` - Password-protected encryption using PBKDF2
- `decryptFile(params)` - Decrypts with stored encryption key
- `decryptFileWithPassword(blob, password, salt, iv)` - Password-based decryption
- `generateEncryptionKey()` - Creates random AES-256 key
- `deriveKeyFromPassword(password, salt)` - PBKDF2 key derivation (100k iterations)
- `hashFile(file)` - SHA-256 file integrity verification
- Helper functions for Base64/hex conversions

**Security Features:**
- 256-bit AES in GCM mode (authenticated encryption)
- Cryptographically secure random IV generation
- High-iteration PBKDF2 (100,000 iterations)
- Keys never leave the device for private files

### 2. Local Keyring (`src/shared/utils/keyring.ts`)

**Secure Storage:**
- IndexedDB-based key storage (browser-local)
- Per-origin sandboxing (no cross-site access)
- Automatic key management

**Key Methods:**
- `storeKey()` - Save encryption key for private file
- `storePasswordProtectedMeta()` - Save metadata for password files
- `getKey()` - Retrieve key for decryption
- `hasKey()` - Check if we can decrypt a file
- `deleteKey()` - Remove key (when deleting file)
- `exportKeyring()` - Backup keys to JSON
- `importKeyring()` - Restore from backup
- `getStats()` - View key statistics

**Security Model:**
- Keys stored only in IndexedDB (encrypted by browser)
- Singleton pattern ensures unified keyring instance
- Automatic cleanup when files are deleted

### 3. Enhanced File Uploader (`src/shared/components/FileUploader.tsx`)

**New UI Features:**
- **Visibility toggle buttons**: Public | Private | Password
- **Password input field** for password-protected files
- **Visual indicators**: Lock icons show encryption status
- **Info text** explains implications of each visibility option
- **Real-time validation**: Requires password for protected files

**File Visibility Options:**
```
🌐 Public:     Anyone with CID can download
🔒 Private:    Only you (key in local keyring) can decrypt
🔑 Password:   Anyone with password can decrypt
```

### 4. Updated Storage Adapters

#### WebTorrent Adapter (`src/adapters/storage/webtorrent.ts`)

**Enhanced Upload:**
- Accepts `UploadOptions` with visibility setting
- Encrypts files client-side before upload for private/password files
- Stores encryption keys in local keyring
- Returns `EncryptionMetadata` with IV, salt, original MIME type

**New Methods:**
- `uploadAndDecrypt(cid)` - Download and decrypt private file
- `downloadWithPassword(cid, password)` - Decrypt password-protected file
- `canDecrypt(cid)` - Check if we have the key

**Hybrid Architecture:**
1. Browser P2P seeding (WebTorrent)
2. Server pinning (long-term storage)
3. Encrypted before upload (for private files)
4. Decryption happens client-side

#### Other Adapters Updated:
- **IndexedDB**: Added `visibility: 'public'`
- **Pinata**: Added `visibility: 'public'` (IPFS is public)
- **Mock**: Added `visibility` field for testing

### 5. Enhanced Database Metadata (`src/adapters/database/gun.ts`)

**New GunFileMetadata Fields:**
```typescript
visibility: FileVisibility;           // public | private | password-protected
encrypted: boolean;                   // Whether file is encrypted
encryptionIv: string;                 // Base64 IV (safe to share)
encryptionSalt?: string;              // For password derivation
originalType: string;                 // MIME type before encryption
fileHash?: string;                    // SHA-256 for integrity
```

**Privacy Design:**
- Only IV shared in metadata (safe, unique per file)
- Salt shared for password files (needed for decryption)
- Actual encryption keys NEVER synced to Gun.js
- File visibility visible to all peers (for UI)

### 6. Main Page Updates (`src/app/page.tsx`)

**Encryption Flow Integration:**
```typescript
// Upload
const result = await storage.upload(file, {
    visibility: 'private',  // or 'public', 'password-protected'
    password: userPassword
});

// Download
if (encrypted && canDecrypt) {
    blob = await storage.downloadAndDecrypt(id);
} else if (encrypted && !canDecrypt) {
    password = prompt('Enter password...');
    blob = await storage.downloadWithPassword(id, password);
} else {
    blob = await storage.download(id);
}
```

**File Display:**
- Shows encryption status (🔒 Private, 🔑 Password)
- Indicates if user can decrypt ("Can't decrypt" warning)
- Updates canDecrypt after checking keyring

### 7. File Grid Display (`src/shared/components/FileGrid.tsx`)

**Visual Indicators:**
- 🌐 Blue badge for **Public** files
- 🔒 Green badge for **Private** files (with lock icon)
- 🔑 Yellow badge for **Password-Protected** files
- ⚠️ Red warning if encrypted but cannot decrypt

---

## 🔒 Server Security Enhancements (`storage/server.js`)

### New Dependencies:
- `helmet` - Security headers
- `express-rate-limit` - Request rate limiting

### Security Features:

**1. Helmet Security Headers**
```javascript
app.use(helmet());
// Adds: X-Frame-Options, X-Content-Type-Options, 
//       Strict-Transport-Security, CSP, etc.
```

**2. CORS Restrictions**
```javascript
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001'
];
// White-list based origin checking
```

**3. Rate Limiting**
```javascript
// Upload: 100 per 15 minutes per IP
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});

// Download: 300 per 1 minute per IP
const downloadLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 300
});

// General: 1000 per 15 minutes per IP
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000
});
```

**4. File Upload Validation**
- Sanitized filenames (alphanumeric, no special chars)
- Max file size: 500MB
- File extension validation
- Multer file filter

**5. Secure Headers on Downloads**
```javascript
res.setHeader('Content-Disposition', `attachment; filename="${sanitized}"`);
res.setHeader('Content-Type', 'application/octet-stream');
res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
```

**6. Error Handling**
- Multer error catching (file too large, etc)
- CORS error responses
- Safe error messages (no info leakage)
- 404 handler

---

## 📋 API Reference

### FileVisibility Type
```typescript
type FileVisibility = 'public' | 'private' | 'password-protected';
```

### UploadResult Interface
```typescript
interface UploadResult {
    cid: string;
    url: string;
    size: number;
    visibility: FileVisibility;
    encryptionMetadata?: {
        iv: string;                    // Base64 encoded
        salt?: string;                 // For password files
        originalType: string;
        originalName: string;
    };
}
```

### LocalKeyring Methods
```typescript
getKeyring(): LocalKeyring;
keyring.storeKey(fileId, key, iv, fileName, mimeType): Promise<void>
keyring.getKey(fileId): Promise<KeyEntry | null>
keyring.hasKey(fileId): Promise<boolean>
keyring.deleteKey(fileId): Promise<void>
keyring.exportKeyring(): Promise<string>
keyring.importKeyring(jsonData): Promise<number>
keyring.getStats(): Promise<{ total, privateFiles, passwordProtected }>
```

### Storage Adapter Methods
```typescript
// Existing
storage.upload(file, options?): Promise<UploadResult>
storage.download(cid): Promise<Blob>
storage.delete(cid): Promise<void>

// New - Encryption aware
storage.downloadAndDecrypt(cid): Promise<Blob>
storage.downloadWithPassword(cid, password): Promise<Blob>
storage.canDecrypt(cid): Promise<boolean>
```

---

## 🔐 Security Best Practices Implemented

### Client-Side Security
✅ **Encryption Before Upload**
- Files encrypted entirely in browser
- Keys never sent to server
- Uses Web Crypto API (hardware-accelerated if available)

✅ **Key Management**
- Random IV per file
- High-entropy key generation
- Keys stored in IndexedDB (per-origin isolation)
- Automatic cleanup on file deletion

✅ **Password Security**
- PBKDF2 with 100,000 iterations
- Random salt per password file
- No plaintext passwords stored
- Keys derived on-demand

### Server-Side Security
✅ **Rate Limiting**
- Prevents brute-force attacks
- DoS mitigation
- Per-IP tracking

✅ **Input Validation**
- Filename sanitization
- File size limits
- MIME type checking

✅ **CORS Protection**
- White-list based
- Prevents cross-site attacks
- Configurable via env variables

✅ **Security Headers**
- Helmet middleware
- Frame options
- Content type sniffing protection

---

## 🚀 Environment Variables

### Storage Server
```bash
# Optional: Comma-separated list of allowed origins
ALLOWED_ORIGINS=http://localhost:3000,http://example.com

# Port (default: 3001)
PORT=3001
```

### Frontend
```bash
# Storage server URL
NEXT_PUBLIC_STORAGE_API=http://localhost:3001

# Gun.js relay
NEXT_PUBLIC_GUN_RELAY=http://localhost:8765/
```

---

## 📊 File Metadata in Gun.js

**Example Private File Metadata:**
```json
{
    "id": "torrent-hash-123",
    "name": "encrypted.pdf",
    "size": 2048576,
    "type": "application/octet-stream",
    "createdAt": 1733363200000,
    "deviceId": "device-xxx",
    "url": "magnet:?xt=urn:btih:...",
    "visibility": "private",
    "encrypted": true,
    "encryptionIv": "Base64EncodedIV",
    "originalType": "application/pdf",
    "magnetURI": "magnet:..."
}
```

**Example Password-Protected File Metadata:**
```json
{
    "id": "torrent-hash-456",
    "name": "encrypted.docx",
    "size": 1048576,
    "visibility": "password-protected",
    "encrypted": true,
    "encryptionIv": "Base64EncodedIV",
    "encryptionSalt": "Base64EncodedSalt",
    "originalType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}
```

---

## 🧪 Testing

All existing tests pass with new types. New encryption flows tested via:
1. Unit tests for crypto utilities
2. Integration tests for upload/download with encryption
3. E2E tests for visibility toggle UI

Run tests:
```bash
npm run test              # Unit tests
npm run test:e2e          # E2E tests
npm run test:coverage     # Coverage report
```

---

## 📝 Usage Examples

### Uploading a Private File
```typescript
const file = new File([...], 'document.pdf', { type: 'application/pdf' });

const result = await storage.upload(file, {
    visibility: 'private'
    // Key automatically generated and stored in keyring
});

console.log(result.cid);  // Torrent hash
console.log(result.encrypted);  // true
```

### Uploading a Password-Protected File
```typescript
const result = await storage.upload(file, {
    visibility: 'password-protected',
    password: 'secure-password-123'
});

// Share the CID + password with recipient
// They can decrypt with: storage.downloadWithPassword(cid, password)
```

### Downloading a Private File
```typescript
// Check if we can decrypt
const canDecrypt = await storage.canDecrypt(cid);

if (canDecrypt) {
    const decryptedBlob = await storage.downloadAndDecrypt(cid);
    // Use decrypted blob
} else {
    console.log('You cannot decrypt this file');
}
```

### Viewing Keyring Statistics
```typescript
const keyring = getKeyring();
const stats = await keyring.getStats();

console.log(`Total keys: ${stats.total}`);
console.log(`Private files: ${stats.privateFiles}`);
console.log(`Password-protected: ${stats.passwordProtected}`);
```

---

## 🔄 Migration Path

### For Existing Users
- Existing public files: No changes needed
- Optional: Export keyring for backup
- New uploads: Choose privacy level

### Future Enhancements
- [ ] Biometric authentication for private key access
- [ ] Hardware security key support
- [ ] Multi-recipient key sharing (not yet)
- [ ] Zero-knowledge proofs for file ownership
- [ ] Decentralized key escrow service
- [ ] Gun.js SEA integration for advanced encryption

---

## 🛠️ Development Notes

### Key Files Modified
1. `src/shared/utils/crypto.ts` - New encryption module
2. `src/shared/utils/keyring.ts` - New keyring module
3. `src/adapters/storage/types.ts` - Added visibility types
4. `src/adapters/storage/webtorrent.ts` - Encryption integration
5. `src/adapters/database/gun.ts` - Privacy metadata
6. `src/app/page.tsx` - Encryption flow logic
7. `src/shared/components/FileUploader.tsx` - Visibility UI
8. `src/shared/components/FileGrid.tsx` - Privacy indicators
9. `storage/server.js` - Security hardening
10. `storage/package.json` - New dependencies

### Build Status
✅ TypeScript compilation successful
✅ All tests passing
✅ No breaking changes to existing APIs

---

## 📚 References

- [Web Crypto API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [AES-GCM Specification](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [PBKDF2 Standard](https://tools.ietf.org/html/rfc8018)
- [OWASP Encryption Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)

---

## ✅ Implementation Checklist

- [x] Crypto utility module with AES-256-GCM
- [x] Local keyring for key management
- [x] File visibility toggle (Public/Private/Password)
- [x] Password-protected files with PBKDF2
- [x] UI components for privacy selection
- [x] Enhanced metadata in Gun.js
- [x] Storage adapter encryption support
- [x] Server rate limiting
- [x] CORS restrictions
- [x] Input validation and sanitization
- [x] Security headers (Helmet)
- [x] File Grid privacy indicators
- [x] Download/decryption logic
- [x] TypeScript compilation
- [x] Test suite compatibility

---

**Last Updated:** December 5, 2025  
**Version:** 1.0.0-security  
**Status:** ✅ Ready for Production
