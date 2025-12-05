# IAMT - Decentralized Web Application

A **modular, TDD-first, future-proof** decentralized web application with swappable storage adapters.

🌐 **Live Demo**: [https://iamt-qkgjlzlo7-remixonwins-projects.vercel.app](https://iamt-qkgjlzlo7-remixonwins-projects.vercel.app)

## Features

- 🔌 **Adapter Pattern** - Swap IPFS for Arweave, Gun.js for Ceramic without code changes
- 🧪 **TDD First** - 19 tests passing, mock adapters for offline testing
- 🎨 **Premium UI** - Glassmorphism, animated gradients, dark mode
- 🌐 **Decentralized Ready** - Static export for IPFS/Fleek deployment

## Quick Start

```bash
npm install
npm run dev     # Start dev server
npm run test    # Run tests in watch mode
```

## Architecture

```
src/
├── adapters/           # Abstraction layer
│   ├── storage/        # IPFS/Arweave adapters
│   └── database/       # Gun.js/Ceramic adapters
├── app/                # Next.js pages
└── features/           # Feature modules (coming soon)
```

## Tech Stack

- **Framework**: Next.js 14 (static export)
- **Styling**: TailwindCSS
- **Testing**: Vitest + Testing Library
- **Deployment**: Vercel

## License

MIT
