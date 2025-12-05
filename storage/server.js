/**
 * WebTorrent P2P Storage Server
 * 
 * Security Features:
 * - Rate limiting to prevent abuse
 * - CORS restrictions for authorized origins
 * - File size limits
 * - Helmet for security headers
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const FILES_DIR = path.join(__dirname, 'files');
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8765'];

// Ensure files directory exists
if (!fs.existsSync(FILES_DIR)) {
    fs.mkdirSync(FILES_DIR, { recursive: true });
}

// Initialize WebTorrent client
const client = new WebTorrent();

// Track active torrents
const torrents = new Map();

const app = express();

// Security middleware
app.use(helmet()); // Add security headers

// CORS configuration
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc)
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS not allowed for origin: ${origin}`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400 // 24 hours
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

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        name: 'IAMT WebTorrent Storage',
        files: torrents.size,
        peersTotal: Array.from(torrents.values()).reduce((sum, t) => sum + t.numPeers, 0),
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
app.get('/download/:hash', downloadLimiter, (req, res) => {
    for (const [, torrent] of torrents) {
        if (torrent.infoHash === req.params.hash && torrent.files.length > 0) {
            const file = torrent.files[0];
            
            // Sanitize filename for header
            const sanitized = file.name
                .replace(/[^a-zA-Z0-9._-]/g, '_')
                .substring(0, 255);
            
            res.setHeader('Content-Disposition', `attachment; filename="${sanitized}"`);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            
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

app.listen(PORT, '0.0.0.0', () => {
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
});
