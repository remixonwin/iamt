# IAMT - Decentralized P2P File Storage

A **fully local, peer-to-peer** file storage app with torrent-like file sharing and **client-side encryption**.

## ✨ Features

- 🔒 **Client-Side Encryption** - AES-256-GCM encryption before upload
- 🌍 **Public/Private Files** - Choose visibility per file
- 🔑 **Password Protection** - Optional password-protected sharing
- 🌐 **P2P Sharing** - WebTorrent-based decentralized storage
- 🔄 **Real-time Sync** - Gun.js for metadata synchronization
- 📱 **Cross-device** - Access from any device with tunneling

## 🔐 Security Features

| Feature | Implementation |
|---------|---------------|
| Encryption | AES-256-GCM (Web Crypto API) |
| Key Storage | IndexedDB (device-local only) |
| Password Keys | PBKDF2 with 100k iterations |
| Rate Limiting | 50 uploads per 15 minutes |
| CORS | Restricted origin whitelist |
| Headers | Helmet security headers |

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
- **Gun.js** - Decentralized database for sync
- **WebTorrent** - P2P file sharing
- **Web Crypto API** - AES-256-GCM encryption
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
│   ├── adapters/    # Storage & DB adapters
│   ├── shared/
│   │   ├── components/  # FileUploader, FileGrid, FilePreview
│   │   └── utils/       # crypto.ts, keyring.ts, fileTypes.ts
│   └── app/         # Next.js pages
└── tests/           # Unit & integration tests
\`\`\`

## 📖 Documentation

- [Security Implementation](./SECURITY_IMPLEMENTATION.md) - Technical details
- [Privacy Guide](./PRIVACY_GUIDE.md) - User guide for encryption

## License

MIT
