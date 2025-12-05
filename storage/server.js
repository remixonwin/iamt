/**
 * WebTorrent P2P Storage Server
 * 
 * Stores files locally and shares them via torrent magnet links.
 * Run with: npm start
 * 
 * Security Features:
 * - Rate limiting to prevent abuse
 * - CORS restrictions for production
 * - Input validation and sanitization
 * - Helmet for security headers
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import WebTorrent from 'webtorrent';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const FILES_DIR = path.join(__dirname, 'files');
const NODE_ENV = process.env.NODE_ENV || 'development';

// Allowed origins for CORS (add your production domains)
const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    process.env.FRONTEND_URL,
].filter(Boolean);

// Ensure files directory exists
if (!fs.existsSync(FILES_DIR)) {
    fs.mkdirSync(FILES_DIR, { recursive: true });
}

// Initialize WebTorrent client
const client = new WebTorrent();

// Track active torrents
const torrents = new Map();

// Simple in-memory rate limiter
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_UPLOADS_PER_WINDOW = 50;
const MAX_DOWNLOADS_PER_WINDOW = 200;

function getRateLimitKey(ip, action) {
    return `${ip}:${action}`;
}

function checkRateLimit(ip, action, maxRequests) {
    const key = getRateLimitKey(ip, action);
    const now = Date.now();
    
    if (!rateLimits.has(key)) {
        rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return { allowed: true, remaining: maxRequests - 1 };
    }
    
    const limit = rateLimits.get(key);
    
    if (now > limit.resetAt) {
        limit.count = 1;
        limit.resetAt = now + RATE_LIMIT_WINDOW;
        return { allowed: true, remaining: maxRequests - 1 };
    }
    
    if (limit.count >= maxRequests) {
        return { allowed: false, remaining: 0, retryAfter: Math.ceil((limit.resetAt - now) / 1000) };
    }
    
    limit.count++;
    return { allowed: true, remaining: maxRequests - limit.count };
}

// Sanitize filename to prevent path traversal attacks
function sanitizeFileName(fileName) {
    // Remove path components and special characters
    return fileName
        .replace(/[/\\]/g, '') // Remove path separators
        .replace(/\.\./g, '') // Remove parent directory references
        .replace(/[<>:"|?*\x00-\x1f]/g, '_') // Replace invalid chars
        .substring(0, 255); // Limit length
}

const app = express();

// Security headers (simple helmet alternative)
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

// CORS configuration
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        if (NODE_ENV === 'development') {
            return callback(null, true);
        }
        
        if (ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));

// Rate limiting middleware for uploads
const uploadRateLimiter = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const result = checkRateLimit(ip, 'upload', MAX_UPLOADS_PER_WINDOW);
    
    res.setHeader('X-RateLimit-Limit', MAX_UPLOADS_PER_WINDOW);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    
    if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter);
        return res.status(429).json({ 
            error: 'Too many uploads. Please try again later.',
            retryAfter: result.retryAfter 
        });
    }
    
    next();
};

// Rate limiting middleware for downloads
const downloadRateLimiter = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const result = checkRateLimit(ip, 'download', MAX_DOWNLOADS_PER_WINDOW);
    
    res.setHeader('X-RateLimit-Limit', MAX_DOWNLOADS_PER_WINDOW);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    
    if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter);
        return res.status(429).json({ 
            error: 'Too many downloads. Please try again later.',
            retryAfter: result.retryAfter 
        });
    }
    
    next();
};

// Multer for file uploads with additional validation
const upload = multer({
    dest: FILES_DIR,
    limits: { 
        fileSize: 500 * 1024 * 1024, // 500MB
        files: 1 // Only one file per request
    },
    fileFilter: (req, file, cb) => {
        // Sanitize the filename
        file.originalname = sanitizeFileName(file.originalname);
        cb(null, true);
    }
});

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        name: 'IAMT WebTorrent Storage',
        version: '2.0.0',
        security: {
            rateLimit: true,
            cors: NODE_ENV === 'production' ? 'restricted' : 'open',
        },
        files: torrents.size,
        peersTotal: Array.from(torrents.values()).reduce((sum, t) => sum + t.numPeers, 0),
    });
});

// Upload file and start seeding
app.post('/upload', uploadRateLimiter, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const filePath = req.file.path;
        const fileName = sanitizeFileName(req.file.originalname);
        const fileHash = createHash('md5').update(fileName + Date.now()).digest('hex');
        const newPath = path.join(FILES_DIR, fileHash);
        fs.renameSync(filePath, newPath);

        console.log(`[Upload] Seeding: ${fileName}`);

        const torrent = await new Promise((resolve, reject) => {
            client.seed(newPath, {
                name: fileName,
                announce: [
                    'wss://tracker.openwebtorrent.com',
                    'wss://tracker.btorrent.xyz',
                ],
            }, resolve);
            client.on('error', reject);
        });

        torrents.set(torrent.magnetURI, torrent);

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
        res.status(500).json({ error: error.message });
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
    for (const [, torrent] of torrents) {
        if (torrent.infoHash === req.params.hash) {
            return res.json({
                id: torrent.infoHash,
                name: torrent.name,
                size: torrent.length,
                magnetURI: torrent.magnetURI,
                peers: torrent.numPeers,
            });
        }
    }
    res.status(404).json({ error: 'Not found' });
});

// Download file (HTTP fallback)
app.get('/download/:hash', (req, res) => {
    for (const [, torrent] of torrents) {
        if (torrent.infoHash === req.params.hash && torrent.files.length > 0) {
            const file = torrent.files[0];
            res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
            file.createReadStream().pipe(res);
            return;
        }
    }
    res.status(404).json({ error: 'Not found' });
});

// Delete file
app.delete('/file/:hash', (req, res) => {
    for (const [magnet, torrent] of torrents) {
        if (torrent.infoHash === req.params.hash) {
            const name = torrent.name;
            torrent.destroy();
            torrents.delete(magnet);
            return res.json({ success: true, deleted: name });
        }
    }
    res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🌐 IAMT WebTorrent P2P Storage');
    console.log('');
    console.log(`   http://localhost:${PORT}`);
    console.log('');
});
