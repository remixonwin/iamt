/**
 * WebTorrent P2P Storage Server
 * 
 * Security Features:
 * - Rate limiting to prevent abuse
 * - CORS restrictions for authorized origins
 * - File size limits
 * - Helmet for security headers
 * - Content-addressable storage (InfoHash-based deduplication)
 * - MinIO S3-compatible object storage for durability
 * 
 * Run with: npm start
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import WebTorrent from 'webtorrent';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as Minio from 'minio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const FILES_DIR = path.join(__dirname, 'files');
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:8765'];

// MinIO configuration
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000');
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'iamtadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'iamtpassword123';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'iamt-files';
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';

// Self-hosted tracker URL (optional)
const TRACKER_URL = process.env.TRACKER_URL;

// Initialize MinIO client
let minioClient = null;
let minioReady = false;

async function initMinIO() {
    try {
        minioClient = new Minio.Client({
            endPoint: MINIO_ENDPOINT,
            port: MINIO_PORT,
            useSSL: MINIO_USE_SSL,
            accessKey: MINIO_ACCESS_KEY,
            secretKey: MINIO_SECRET_KEY,
        });

        // Check if bucket exists, create if not
        const exists = await minioClient.bucketExists(MINIO_BUCKET);
        if (!exists) {
            await minioClient.makeBucket(MINIO_BUCKET);
            console.log(`[MinIO] Created bucket: ${MINIO_BUCKET}`);
        }
        minioReady = true;
        console.log(`[MinIO] Connected to ${MINIO_ENDPOINT}:${MINIO_PORT}`);
    } catch (err) {
        console.warn('[MinIO] Not available, using local filesystem only:', err.message);
        minioReady = false;
    }
}

// Initialize MinIO on startup
initMinIO();

// Kubo (IPFS) configuration
const KUBO_API = process.env.KUBO_API || 'http://localhost:5001';
const KUBO_GATEWAY = process.env.KUBO_GATEWAY || 'http://localhost:8080';
let kuboReady = false;

async function initKubo() {
    try {
        const response = await fetch(`${KUBO_API}/api/v0/id`, { method: 'POST' });
        if (response.ok) {
            const data = await response.json();
            kuboReady = true;
            console.log(`[Kubo] Connected to IPFS node: ${data.ID.substring(0, 16)}...`);
        }
    } catch (err) {
        console.warn('[Kubo] IPFS not available:', err.message);
        kuboReady = false;
    }
}

// Initialize Kubo on startup
initKubo();

// Helper to upload file to IPFS
async function uploadToIPFS(filePath, fileName) {
    if (!kuboReady) return null;
    
    try {
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(filePath);
        const blob = new Blob([fileBuffer]);
        formData.append('file', blob, fileName);
        
        const response = await fetch(`${KUBO_API}/api/v0/add?pin=true&cid-version=1`, {
            method: 'POST',
            body: formData,
        });
        
        if (response.ok) {
            const text = await response.text();
            const lines = text.trim().split('\n');
            const result = JSON.parse(lines[lines.length - 1]);
            return result.Hash;
        }
    } catch (err) {
        console.warn(`[Kubo] Upload failed: ${err.message}`);
    }
    return null;
}

// Helper to download file from IPFS
async function downloadFromIPFS(cid) {
    if (!kuboReady) return null;
    
    try {
        const response = await fetch(`${KUBO_GATEWAY}/ipfs/${cid}`);
        if (response.ok) {
            return response;
        }
    } catch (err) {
        console.warn(`[Kubo] Download failed: ${err.message}`);
    }
    return null;
}

// Ensure files directory exists
if (!fs.existsSync(FILES_DIR)) {
    fs.mkdirSync(FILES_DIR, { recursive: true });
}

// Build tracker list with self-hosted tracker if available
const trackerList = [
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.btorrent.xyz',
    'wss://tracker.webtorrent.dev',
    'wss://tracker.files.fm:7073/announce',
];
if (TRACKER_URL) {
    trackerList.unshift(TRACKER_URL); // Prioritize self-hosted tracker
    console.log(`[Tracker] Using self-hosted tracker: ${TRACKER_URL}`);
}

// Initialize WebTorrent client with DHT and multiple trackers
const client = new WebTorrent({
    dht: true, // Enable DHT for tracker-less peer discovery
    tracker: {
        announce: trackerList
    }
});

// Content-addressable storage: Map InfoHash -> Torrent
// This allows multiple files with identical content to share the same torrent
const torrents = new Map(); // InfoHash -> Torrent object
const filePaths = new Map(); // InfoHash -> Array of disk paths (for duplicates)

const app = express();

// CORS configuration - must come BEFORE helmet
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        // Check allowed origins
        if (ALLOWED_ORIGINS.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }

        return callback(new Error('CORS not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
    maxAge: 86400 // 24 hours
}));

// Security middleware - configured to not block CORS
app.use(helmet({
    crossOriginResourcePolicy: false,  // Allow cross-origin resource access
    crossOriginOpenerPolicy: false,    // Don't restrict opener policy
    crossOriginEmbedderPolicy: false,  // Don't require COEP
}));

app.use(express.json());


// Rate limiting
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit to 100 uploads per 15 minutes per IP
    message: { error: 'Too many uploads, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for health checks and info endpoints
        return req.path === '/' || req.path === '/files';
    }
});

const downloadLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 300, // Limit to 300 downloads per minute per IP
    message: { error: 'Too many downloads, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // General requests limit
    standardHeaders: false,
    legacyHeaders: false,
});

// Apply general limiter to all routes
app.use(generalLimiter);

// Multer for file uploads with validation
const upload = multer({
    dest: FILES_DIR,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max
        files: 1 // One file per request
    },
    fileFilter: (req, file, cb) => {
        // Sanitize filename
        const sanitized = file.originalname
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .substring(0, 255);

        if (!sanitized || sanitized.length === 0) {
            return cb(new Error('Invalid filename'));
        }

        file.originalname = sanitized;
        cb(null, true);
    }
});

// Health check with detailed P2P metrics
app.get('/', (req, res) => {
    const torrentList = Array.from(torrents.values());
    const totalPeers = torrentList.reduce((sum, t) => sum + t.numPeers, 0);
    const totalSeeds = torrentList.filter(t => t.progress === 1).length;
    const totalSize = torrentList.reduce((sum, t) => sum + (t.length || 0), 0);
    
    res.json({
        status: 'ok',
        name: 'IAMT WebTorrent Storage',
        version: '2.0.0',
        files: torrents.size,
        peersTotal: totalPeers,
        seedingCount: totalSeeds,
        totalStorageBytes: totalSize,
        dhtEnabled: true,
        trackers: trackerList.length,
        minioEnabled: minioReady,
        uptime: process.uptime(),
    });
});

// Detailed health endpoint for monitoring
app.get('/health', (req, res) => {
    const torrentList = Array.from(torrents.values());
    res.json({
        status: 'healthy',
        storage: {
            files: torrents.size,
            totalBytes: torrentList.reduce((sum, t) => sum + (t.length || 0), 0),
        },
        p2p: {
            dht: true,
            trackers: trackerList,
            totalPeers: torrentList.reduce((sum, t) => sum + t.numPeers, 0),
            activeTorrents: torrentList.map(t => ({
                hash: t.infoHash,
                name: t.name,
                peers: t.numPeers,
                progress: t.progress,
                uploaded: t.uploaded,
                downloaded: t.downloaded,
            })),
        },
        minio: {
            enabled: minioReady,
            endpoint: minioReady ? `${MINIO_ENDPOINT}:${MINIO_PORT}` : null,
            bucket: minioReady ? MINIO_BUCKET : null,
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
    });
});

// Upload file and start seeding
app.post('/upload', uploadLimiter, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const filePath = req.file.path;
        const fileName = req.file.originalname;
        const newPath = path.join(FILES_DIR, `${Date.now()}-${fileName}`);

        // Safe rename with error handling
        try {
            fs.renameSync(filePath, newPath);
        } catch (err) {
            fs.unlinkSync(filePath); // Clean up
            return res.status(400).json({ error: 'File processing failed' });
        }

        console.log(`[Upload] Seeding: ${fileName}`);

        const torrent = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Torrent creation timeout'));
            }, 30000);

            client.seed(newPath, {
                name: fileName,
                announce: [
                    'wss://tracker.openwebtorrent.com',
                    'wss://tracker.btorrent.xyz',
                    'wss://tracker.webtorrent.dev',
                    'wss://tracker.files.fm:7073/announce',
                ],
            }, (torrent) => {
                clearTimeout(timeout);
                resolve(torrent);
            });

            client.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });

        // Store by InfoHash for content-addressable lookup
        torrents.set(torrent.infoHash, torrent);

        // Track file path
        if (!filePaths.has(torrent.infoHash)) {
            filePaths.set(torrent.infoHash, []);
        }
        filePaths.get(torrent.infoHash).push(newPath);

        // Store disk path on torrent object for compatibility
        torrent.diskPath = newPath;

        // Backup to MinIO for durability (async, don't block response)
        if (minioReady && minioClient) {
            const objectName = `${torrent.infoHash}/${fileName}`;
            minioClient.fPutObject(MINIO_BUCKET, objectName, newPath)
                .then(() => {
                    console.log(`[MinIO] Backed up: ${objectName}`);
                })
                .catch(err => {
                    console.warn(`[MinIO] Backup failed: ${err.message}`);
                });
        }

        console.log(`[Magnet] ${torrent.magnetURI.substring(0, 60)}...`);

        res.json({
            success: true,
            id: torrent.infoHash,
            name: fileName,
            size: req.file.size,
            magnetURI: torrent.magnetURI,
            infoHash: torrent.infoHash,
            peers: torrent.numPeers,
        });

    } catch (error) {
        console.error('[Upload Error]', error);
        res.status(500).json({ error: 'Upload failed: ' + error.message });
    }
});

// List all files
app.get('/files', (req, res) => {
    const files = Array.from(torrents.values()).map(torrent => ({
        id: torrent.infoHash,
        name: torrent.name,
        size: torrent.length,
        magnetURI: torrent.magnetURI,
        peers: torrent.numPeers,
    }));
    res.json({ files, total: files.length });
});

// Get file info
app.get('/file/:hash', (req, res) => {
    const torrent = torrents.get(req.params.hash);

    if (torrent) {
        return res.json({
            id: torrent.infoHash,
            name: torrent.name,
            size: torrent.length,
            magnetURI: torrent.magnetURI,
            peers: torrent.numPeers,
        });
    }

    res.status(404).json({ error: 'Not found' });
});

// Download file (HTTP fallback)
app.get('/download/:hash', (req, res) => {
    console.log(`[Download] Request for hash: ${req.params.hash}`);
    console.log(`[Download] Torrents in map: ${torrents.size}`);

    const torrent = torrents.get(req.params.hash);

    if (torrent) {
        console.log(`[Download] Found torrent: ${torrent.name}`);

        // Prefer direct disk access if available (avoids WebTorrent path issues)
        // Try the primary disk path first
        if (torrent.diskPath && fs.existsSync(torrent.diskPath)) {
            console.log(`[Download] Using disk path: ${torrent.diskPath}`);
            return safeDownload(res, torrent.diskPath, torrent.name);
        }

        // Try any alternative file paths for duplicates
        const paths = filePaths.get(req.params.hash);
        if (paths && paths.length > 0) {
            for (const path of paths) {
                if (fs.existsSync(path)) {
                    console.log(`[Download] Using alternative disk path: ${path}`);
                    return safeDownload(res, path, torrent.name);
                }
            }
        }

        // Fallback to WebTorrent stream (e.g. if memory-only or remote)
        if (torrent.files && torrent.files.length > 0) {
            console.log(`[Download] Using WebTorrent stream`);
            const file = torrent.files[0];
            res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
            const stream = file.createReadStream();
            stream.on('error', (err) => {
                console.error('Stream error:', err);
                if (!res.headersSent) res.status(500).end();
            });
            stream.pipe(res);
            return;
        }
    }

    // Try MinIO fallback if local file not found
    if (minioReady && minioClient) {
        console.log(`[Download] Trying MinIO fallback for: ${req.params.hash}`);
        try {
            // List objects with the hash prefix to find the file
            const objectsStream = minioClient.listObjects(MINIO_BUCKET, `${req.params.hash}/`, false);
            let objectName = null;
            
            objectsStream.on('data', (obj) => {
                if (!objectName && obj.name) {
                    objectName = obj.name;
                }
            });
            
            objectsStream.on('end', async () => {
                if (objectName) {
                    try {
                        const fileName = objectName.split('/').pop() || 'download';
                        console.log(`[Download] Found in MinIO: ${objectName}`);
                        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
                        const stream = await minioClient.getObject(MINIO_BUCKET, objectName);
                        stream.pipe(res);
                    } catch (err) {
                        console.error('[MinIO Download Error]', err);
                        if (!res.headersSent) {
                            res.status(404).json({ error: 'Not found' });
                        }
                    }
                } else {
                    console.log(`[Download] Hash not found in MinIO: ${req.params.hash}`);
                    if (!res.headersSent) {
                        res.status(404).json({ error: 'Not found' });
                    }
                }
            });
            
            objectsStream.on('error', (err) => {
                console.error('[MinIO List Error]', err);
                if (!res.headersSent) {
                    res.status(404).json({ error: 'Not found' });
                }
            });
            return;
        } catch (err) {
            console.error('[MinIO Fallback Error]', err);
        }
    }

    console.log(`[Download] Hash not found: ${req.params.hash}`);
    console.log(`[Download] Available hashes:`, Array.from(torrents.keys()));
    res.status(404).json({ error: 'Not found' });
});

// Delete file
app.delete('/file/:hash', (req, res) => {
    const torrent = torrents.get(req.params.hash);

    if (torrent) {
        const name = torrent.name;
        torrent.destroy();
        torrents.delete(req.params.hash);
        filePaths.delete(req.params.hash);
        return res.json({ success: true, deleted: name });
    }

    res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[Error]', err);

    if (err instanceof multer.MulterError) {
        if (err.code === 'FILE_TOO_LARGE') {
            return res.status(413).json({ error: 'File too large (max 500MB)' });
        }
        return res.status(400).json({ error: 'File upload error: ' + err.message });
    }

    if (err.message && err.message.includes('CORS')) {
        return res.status(403).json({ error: 'CORS not allowed' });
    }

    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Re-seed existing files on startup
async function reseedExistingFiles() {
    try {
        if (!fs.existsSync(FILES_DIR)) return;

        const files = fs.readdirSync(FILES_DIR);
        console.log(`[Startup] Found ${files.length} existing files to re-seed`);

        for (const fileName of files) {
            // Skip hidden files or non-files
            if (fileName.startsWith('.')) continue;

            const filePath = path.join(FILES_DIR, fileName);
            try {
                const stat = fs.statSync(filePath);
                if (!stat.isFile()) continue;
            } catch (e) {
                continue;
            }

            try {
                // First, try to seed the file
                let torrent;
                let infoHash;

                try {
                    torrent = await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Error('Seeding timeout'));
                        }, 10000);

                        // Reconstruct name (simple heuristic)
                        const cleanName = fileName.replace(/^\d+-/, '');

                        client.seed(filePath, {
                            name: cleanName,
                            announce: [
                                'wss://tracker.openwebtorrent.com',
                                'wss://tracker.btorrent.xyz',
                            ],
                        }, (t) => {
                            clearTimeout(timeout);
                            resolve(t);
                        });

                        client.on('error', (err) => {
                            clearTimeout(timeout);
                            reject(err);
                        });
                    });

                    infoHash = torrent.infoHash;
                } catch (error) {
                    // If error contains "already being seeded", it's a duplicate - find the existing torrent
                    if (error.message && error.message.includes('already')) {
                        // Find existing torrent by checking all torrents for matching content
                        // This is a workaround since WebTorrent rejects duplicates
                        console.log(`[Re-seed] ${fileName} is a duplicate, finding existing torrent...`);

                        // Try to get infoHash by computing it from the file
                        // For now, we'll skip this file and let it be served from disk if needed
                        console.warn(`[Re-seed] Skipping duplicate: ${fileName}`);
                        continue;
                    }
                    throw error;
                }

                // Store by InfoHash
                if (!torrents.has(infoHash)) {
                    torrents.set(infoHash, torrent);
                }

                // Track file path (handles duplicates)
                if (!filePaths.has(infoHash)) {
                    filePaths.set(infoHash, []);
                }
                filePaths.get(infoHash).push(filePath);

                // Store disk path on torrent object for compatibility
                if (!torrent.diskPath) {
                    torrent.diskPath = filePath;
                }

                console.log(`[Re-seed] ${fileName} -> ${infoHash}`);
            } catch (error) {
                console.error(`[Re-seed Error] ${fileName}:`, error.message);
            }
        }

        console.log(`[Startup] Re-seeding complete. ${torrents.size} unique torrents active.`);
    } catch (err) {
        console.error('[Startup] Re-seeding failed:', err);
    }
}

app.listen(PORT, '0.0.0.0', async () => {
    console.log('');
    console.log('🌐 IAMT WebTorrent P2P Storage');
    console.log('');
    console.log(`   http://localhost:${PORT}`);
    console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log('');
    console.log('Security features enabled:');
    console.log('   ✓ Helmet security headers');
    console.log('   ✓ Rate limiting');
    console.log('   ✓ CORS restrictions');
    console.log('   ✓ File size limits');
    console.log('');

    // Start re-seeding
    await reseedExistingFiles();
});

// Helper for safe downloads
const safeDownload = (res, filePath, fileName) => {
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
        console.error(`[Download Error] ${fileName}:`, err.message);
        if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
    });
    stream.pipe(res);
};
