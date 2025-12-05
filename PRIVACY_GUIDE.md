# IAMT Privacy & Security Quick Start Guide

## 🚀 Getting Started

### Installation
```bash
# Install dependencies
npm install

# Build
npm run build

# Start storage server (terminal 1)
cd storage && npm install && npm start

# Start frontend (terminal 2)
npm run dev
```

---

## 🔐 Using Private/Password-Protected Files

### 1. Upload a Private File (Only You Can Access)

```
1. Click "Upload" tab
2. Click "Private" button (🔒)
3. Select your file
4. Your encryption key is automatically stored locally
```

✅ **What happens:**
- File encrypted with AES-256-GCM
- Encryption key saved in browser's IndexedDB
- Encrypted file uploaded to P2P network
- Only you can decrypt it (key stays on your device)

### 2. Upload a Password-Protected File (Share with Others)

```
1. Click "Upload" tab
2. Click "Password" button (🔑)
3. Enter a password (share this with recipients)
4. Select your file
5. Upload
```

✅ **What happens:**
- File encrypted with PBKDF2-derived key
- Password metadata saved locally
- Encrypted file uploaded
- Anyone with the password can decrypt

### 3. Download a File

**Public Files:**
- Click file → Opens immediately

**Your Private Files:**
- Click file → Decrypts automatically (key is in your device)

**Password-Protected Files (not yours):**
- Click file → Prompts for password → Decrypts if correct

---

## 🔑 Managing Your Encryption Keys

### View Key Statistics
```bash
# In browser console:
import { getKeyring } from '@/shared/utils/keyring';
const keyring = getKeyring();
const stats = await keyring.getStats();
console.log(stats);
// Output: { total: 5, privateFiles: 3, passwordProtected: 2 }
```

### Backup Your Keys
```javascript
const keyring = getKeyring();
const backup = await keyring.exportKeyring();

// Save to file
const blob = new Blob([backup], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'iamt-keyring-backup.json';
a.click();
```

### Restore Keys from Backup
```javascript
const keyring = getKeyring();
const jsonData = '{"version":1,"keys":[...]}'; // from backup file
const imported = await keyring.importKeyring(jsonData);
console.log(`Imported ${imported} keys`);
```

---

## 🛡️ Security Features

### Encryption
- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Strength:** 256-bit keys (military-grade)
- **IV:** Random per file (prevents pattern analysis)

### Password Files
- **Key Derivation:** PBKDF2 with SHA-256
- **Iterations:** 100,000 (makes brute-force expensive)
- **Salt:** Random per file

### Key Storage
- **Location:** Browser IndexedDB (encrypted by browser)
- **Scope:** Per-origin (cannot be accessed by other websites)
- **Lifetime:** Persists until file is deleted

---

## 📊 File Visibility Comparison

| Feature | Public | Private | Password |
|---------|--------|---------|----------|
| **Encrypted** | ❌ No | ✅ Yes | ✅ Yes |
| **Key Storage** | N/A | 📁 Your device | 📁 Your device |
| **Who Can Access** | Anyone | Only you | Anyone with password |
| **Sharing** | Share CID | Can't share* | Share CID + password |
| **Security** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

*Private files can only be accessed by the original device where uploaded

---

## 🚨 Important Security Notes

### Do's ✅
- ✅ Use **Private** for sensitive documents
- ✅ Use **Password** to securely share files
- ✅ **Backup your encryption keys** regularly
- ✅ Use **strong passwords** for password-protected files
- ✅ Keep your **browser updated**

### Don'ts ❌
- ❌ Don't share your **encryption keys** with anyone
- ❌ Don't forget your **backup passwords**
- ❌ Don't use **weak passwords** (e.g., "123456")
- ❌ Don't clear **browser storage** without backup
- ❌ Don't share **password files** with untrusted people

---

## 🔧 Server Configuration

### Allow CORS from Custom Domains
```bash
export ALLOWED_ORIGINS="http://localhost:3000,https://myapp.com,https://app.mysite.io"
npm start
```

### Adjust Rate Limits

Edit `storage/server.js`:
```javascript
const uploadLimiter = rateLimit({
    max: 100,  // Change this (uploads per 15 min)
});

const downloadLimiter = rateLimit({
    max: 300,  // Change this (downloads per 1 min)
});
```

---

## 🐛 Troubleshooting

### "File encrypted but cannot decrypt"
**Cause:** Key not in your browser's keyring  
**Solution:**
- You're on a different device
- Browser storage was cleared
- Use password if available
- Check backup restore

### "Can't encrypt files"
**Cause:** Web Crypto API not available  
**Solution:**
- Use HTTPS (required for Web Crypto in prod)
- Use modern browser (Chrome, Firefox, Safari, Edge)
- Check browser DevTools console for errors

### "Password-protected upload fails"
**Cause:** Empty/invalid password  
**Solution:**
- Enter a password before uploading
- Password must be at least 1 character (use longer for security)

### "Backup import says invalid format"
**Cause:** Wrong JSON structure  
**Solution:**
- Only import backups created by "exportKeyring()"
- Check file wasn't corrupted
- Try again with original backup

---

## 📱 Privacy Across Devices

### Scenario 1: Share Private File Between Your Devices
❌ **Not possible directly** (key is device-specific)

**Workaround:**
1. Download encrypted file from Device A
2. Upload as **password-protected** on Device A
3. Share CID + password with Device B
4. Device B downloads and decrypts with password

### Scenario 2: Back Up Private Files
✅ **Use Export/Import:**
1. Export keyring from Device A
2. Save backup file
3. Transfer backup to Device B (via email, Drive, etc.)
4. Import on Device B

---

## 🔍 How It Works (Technical)

### Private File Flow
```
User's File
    ↓
[AES-256-GCM Encryption] ← Random 256-bit key
    ↓
Encrypted Blob
    ↓
Upload to P2P Network
    ↓
Store Encryption Key
    ├─ Where? Browser's IndexedDB
    ├─ In plain? No, encrypted by browser
    └─ When deleted? When file is deleted
```

### Password File Flow
```
User's Password
    ↓
[PBKDF2 Key Derivation] ← 100,000 iterations
    ↓
Derived 256-bit Key
    ↓
[AES-256-GCM Encryption]
    ↓
Encrypted Blob + Salt + IV
    ↓
Upload to P2P Network
    ↓
Store Salt + IV (needed for decryption)
```

### Decryption Flow
```
Encrypted Blob + IV
    ↓
[AES-256-GCM Decryption]
    ↓ (requires key)
├─ Private: Get from IndexedDB keyring
├─ Password: Derive from user's password + salt
└─ Public: No decryption needed
    ↓
Original File Blob
```

---

## 📞 Support & Issues

### Report Security Issues
⚠️ **DO NOT** post security vulnerabilities publicly  
📧 Contact maintainers privately

### Bug Reports
Include:
- Browser & version
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any)

### Feature Requests
- More encryption options
- Hardware key support
- Biometric authentication
- Multi-device sync

---

## 📚 Learning Resources

### Cryptography Basics
- [OWASP Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Web Crypto API MDN Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

### Security Best Practices
- [NIST Guidelines](https://csrc.nist.gov/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

### P2P Concepts
- [WebTorrent Documentation](https://webtorrent.io/)
- [Gun.js Guide](https://gun.eco/)

---

**Last Updated:** December 5, 2025  
**Version:** 1.0.0  
**Status:** Production Ready
