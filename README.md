# IAMT - Decentralized P2P File Storage

A **fully local, peer-to-peer** file storage app with torrent-like file sharing.

## 🚀 Quick Start

### 1. Start All Servers
```bash
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
```

### 2. Open the App
- **Local**: http://localhost:3000
- **Any device**: https://iamt-relay.loca.lt (with tunnels running)

## 📦 Architecture

```
┌─────────────────────────────────────────────┐
│              Your Machine                    │
│  ┌────────────────┐  ┌────────────────────┐ │
│  │ Gun.js Relay   │  │ WebTorrent Storage │ │
│  │ Port 8765      │  │ Port 3001          │ │
│  │ (sync metadata)│  │ (seed files P2P)   │ │
│  └────────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────┘
         │                    │
    Localtunnel          Localtunnel
         ▼                    ▼
  iamt-relay.loca.lt   iamt-storage.loca.lt
         │                    │
         └────────┬───────────┘
                  ▼
            Any Device
       (Phone, Laptop, etc.)
```

## 🔧 Tech Stack

- **Next.js 14** - App framework
- **Gun.js** - Decentralized database for sync
- **WebTorrent** - P2P file sharing
- **Localtunnel** - Public URL for local servers
- **Vitest + Playwright** - Testing (49 tests)

## 🧪 Run Tests

```bash
npm run test        # Unit tests (34)
npm run test:e2e    # E2E tests (15)
```

## 📁 Project Structure

```
├── relay/           # Gun.js relay server
│   └── server.js
├── storage/         # WebTorrent storage server
│   └── server.js
├── src/
│   ├── adapters/    # Storage & DB adapters
│   ├── shared/      # Components & utilities
│   └── app/         # Next.js pages
└── tests/           # Test files
```

## License

MIT
