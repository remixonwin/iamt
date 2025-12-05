/**
 * WebTorrent P2P Storage Server
 * 
 * Stores files locally and shares them via torrent magnet links.
 * Run with: npm start
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import WebTorrent from 'webtorrent';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const FILES_DIR = path.join(__dirname, 'files');

// Ensure files directory exists
if (!fs.existsSync(FILES_DIR)) {
    fs.mkdirSync(FILES_DIR, { recursive: true });
}

// Initialize WebTorrent client
const client = new WebTorrent();

// Track active torrents
const torrents = new Map();

// Re-seed existing files on startup
async function reseedExistingFiles() {
    const files = fs.readdirSync(FILES_DIR);
    console.log(`[Startup] Found ${files.length} existing files to re-seed`);
    
    for (const fileName of files) {
        const filePath = path.join(FILES_DIR, fileName);
        const stat = fs.statSync(filePath);
        
        if (!stat.isFile()) continue;
        
        try {
            const torrent = await new Promise((resolve, reject) => {
                client.seed(filePath, {
                    name: fileName.replace(/^\d+-/, ''), // Remove timestamp prefix
                    announce: [
                        'wss://tracker.openwebtorrent.com',
                        'wss://tracker.btorrent.xyz',
                    ],
                }, resolve);
                
                // Timeout after 10 seconds
                setTimeout(() => reject(new Error('Seeding timeout')), 10000);
            });
            
            torrents.set(torrent.magnetURI, torrent);
            console.log(`[Re-seed] ${fileName} -> ${torrent.infoHash}`);
        } catch (error) {
            console.error(`[Re-seed Error] ${fileName}:`, error.message);
        }
    }
    
    console.log(`[Startup] Re-seeding complete. ${torrents.size} torrents active.`);
}

const app = express();
app.use(cors()); // Allow all origins
app.use(express.json());

// Multer for file uploads
const upload = multer({
    dest: FILES_DIR,
    limits: { fileSize: 500 * 1024 * 1024 }
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
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const filePath = req.file.path;
        const fileName = req.file.originalname;
        const newPath = path.join(FILES_DIR, `${Date.now()}-${fileName}`);
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
        if (torrent.infoHash === req.params.hash) {
            // Get the file path from the torrent
            const filePath = torrent.path;
            
            if (fs.existsSync(filePath)) {
                res.setHeader('Content-Disposition', `attachment; filename="${torrent.name}"`);
                res.setHeader('Content-Type', 'application/octet-stream');
                fs.createReadStream(filePath).pipe(res);
                return;
            } else if (torrent.files && torrent.files.length > 0) {
                // Fallback to WebTorrent file streaming
                const file = torrent.files[0];
                res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
                file.createReadStream().pipe(res);
                return;
            }
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

app.listen(PORT, '0.0.0.0', async () => {
    console.log('');
    console.log('🌐 IAMT WebTorrent P2P Storage');
    console.log('');
    console.log(`   http://localhost:${PORT}`);
    console.log('');
    
    // Re-seed existing files
    await reseedExistingFiles();
});
