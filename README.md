# IAMT - Decentralized P2P File Storage

A **fully local, peer-to-peer** file storage app with torrent-like file sharing, **client-side encryption**, and **decentralized identity**.

## ✨ Features

- 🔒 **Client-Side Encryption** - AES-256-GCM encryption before upload
- 🌍 **Public/Private Files** - Choose visibility per file
- 🔑 **Password Protection** - Optional password-protected sharing
- 🌐 **P2P Sharing** - WebTorrent-based decentralized storage
- 🔄 **Real-time Sync** - Gun.js for metadata synchronization
- 📱 **Cross-device** - Access from any device with tunneling
- 👤 **Decentralized Identity** - Gun.js SEA with did:key format
- 🔐 **Account Recovery** - 12-word BIP39 seed phrase backup
- ✉️ **Email Verification** - Magic link email verification

## 🔐 Security Features

| Feature | Implementation |
|---------|---------------|
| Encryption | AES-256-GCM (Web Crypto API) |
| Key Storage | IndexedDB (device-local only) |
| Password Keys | PBKDF2 with 100k iterations |
| Rate Limiting | 50 uploads per 15 minutes |
| CORS | Restricted origin whitelist |
| Headers | Helmet security headers |
| Identity | Gun.js SEA + did:key (decentralized) |
| Recovery | 12-word BIP39 seed phrase |

### File Visibility Options

- **🌍 Public**: Unencrypted, accessible to anyone with the link
- **🔒 Private**: Encrypted, only accessible on your device
- **🔑 Password**: Encrypted, shareable with password

## 🚀 Quick Start

### 1. Start All Servers

#### Option A: Docker (Recommended)
\`\`\`bash
docker compose up --build
\`\`\`

#### Option B: Manual
\`\`\`bash
# Terminal 1: Gun.js relay (P2P sync)
cd relay && npm start

# Terminal 2: WebTorrent storage (file hosting)
cd storage && npm start

# Terminal 3: Tunnel for relay
npx localtunnel --port 8765 --subdomain iamt-relay

# Terminal 4: Tunnel for storage
npx localtunnel --port 3001 --subdomain iamt-storage

# Terminal 5: Next.js app
npm run dev
\`\`\`

### 2. Open the App
- **Local**: http://localhost:3000
- **Any device**: https://iamt-relay.loca.lt (with tunnels running)

## 📦 Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                     Your Device                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Encryption   │  │ Local        │  │ IndexedDB        │   │
│  │ (Web Crypto) │  │ Keyring      │  │ (Keys + Files)   │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
              Encrypted files only ↓
┌─────────────────────────────────────────────────────────────┐
│                    Server Layer                              │
│  ┌────────────────┐  ┌────────────────────┐                 │
│  │ Gun.js Relay   │  │ WebTorrent Storage │                 │
│  │ Port 8765      │  │ Port 3001          │                 │
│  │ (sync metadata)│  │ (seed files P2P)   │                 │
│  └────────────────┘  └────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
         │                    │
    Localtunnel          Localtunnel
         ▼                    ▼
  iamt-relay.loca.lt   iamt-storage.loca.lt
\`\`\`

## 🔧 Tech Stack

- **Next.js 14** - App framework
- **Gun.js + SEA** - Decentralized database & authentication
- **WebTorrent** - P2P file sharing
- **Web Crypto API** - AES-256-GCM encryption
- **BIP39** - Seed phrase generation
- **Resend** - Email delivery for magic links
- **Helmet** - Security headers
- **Vitest + Playwright** - Testing (86+ tests)

## 🧪 Run Tests

\`\`\`bash
npm run test        # Unit tests (86)
npm run test:e2e    # E2E tests (15)
npm run build       # Production build
\`\`\`

## 📁 Project Structure

\`\`\`
├── relay/           # Gun.js relay server
│   └── server.js
├── storage/         # WebTorrent storage server (hardened)
│   └── server.js
├── src/
│   ├── adapters/
│   │   ├── database/    # Gun.js adapter
│   │   ├── storage/     # WebTorrent, IndexedDB, Pinata
│   │   └── identity/    # Gun.js SEA, magic links, did:key
│   ├── shared/
│   │   ├── components/  # FileUploader, FileGrid, ProfileCard, etc.
│   │   ├── contexts/    # AuthContext for authentication
│   │   └── utils/       # crypto.ts, keyring.ts, fileTypes.ts
│   └── app/
│       ├── auth/        # Login, signup, verify pages
│       ├── profile/     # User profile dashboard
│       └── api/         # Magic link email API
└── tests/           # Unit & integration tests
\`\`\`

## 👤 User Authentication

IAMT uses **decentralized identity** with Gun.js SEA:

1. **Sign Up** - Create account with email/password
2. **Seed Phrase** - Receive 12-word BIP39 recovery phrase
3. **Email Verification** - Verify via magic link
4. **Profile Dashboard** - View DID, manage recovery settings
5. **Account Recovery** - Recover with seed phrase or email

### Environment Variables

For email verification, set in \`.env.local\`:
\`\`\`bash
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
\`\`\`

## 📖 Documentation

- [Security Implementation](./SECURITY_IMPLEMENTATION.md) - Technical details
- [Privacy Guide](./PRIVACY_GUIDE.md) - User guide for encryption

## 🔧 Troubleshooting

### Files not appearing in "My Files"
If uploaded files don't appear in "My Files":
1. Check browser console for errors
2. File metadata is saved to localStorage as backup - should work even if Gun.js relay is down
3. Ensure the storage server is running: `cd storage && npm start`
4. Refresh the page to reload from localStorage backup

### CORS Errors
If you see CORS errors when uploading:
1. Ensure the storage server allows your origin in `ALLOWED_ORIGINS`
2. Port 3002 is included by default for Next.js dev server
3. The storage server must be running before the frontend

### Gun.js Connection Issues
- The relay server (`port 8765`) enables real-time sync across devices
- Without the relay, files are stored locally via localStorage backup
- Start the relay: `cd relay && npm start`

## License

MIT
