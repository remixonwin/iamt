# IAMT - Decentralized File Storage

A **permanent, browser-based** file storage application with drag-and-drop uploads.

🌐 **Live Demo**: [https://iamt-9h1y4xcwi-remixonwins-projects.vercel.app](https://iamt-9h1y4xcwi-remixonwins-projects.vercel.app)

## Features

- 📁 **Drag-and-drop** file uploads
- 💾 **Permanent storage** via IndexedDB (survives browser restarts)
- 📄 **PDF, Audio, Video, Image** support
- 🎵 **Inline audio player** in file grid
- 🔌 **Adapter pattern** for swappable storage backends

## Quick Start

```bash
npm install
npm run dev     # Start dev server at localhost:3000
npm run test    # Run unit tests (34 tests)
npm run test:e2e # Run E2E tests (15 tests)
```

## Architecture

```
src/
├── adapters/           # Storage abstraction layer
│   ├── storage/
│   │   ├── indexeddb.ts  # Permanent browser storage
│   │   └── mock.ts       # Testing mock
│   └── database/
├── shared/
│   ├── components/     # FileUploader, FilePreview, FileGrid
│   └── utils/          # File type detection
└── app/                # Next.js pages
```

## Storage

Files are stored permanently in **IndexedDB**:
- Survives browser restarts
- ~50% of available disk space
- No external servers required

## Tech Stack

- Next.js 14 (static export)
- TypeScript
- TailwindCSS
- Vitest + Playwright
- IndexedDB for persistence

## License

MIT
