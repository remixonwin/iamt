/**
 * Self-Hosted BitTorrent Tracker Server
 * 
 * Provides WebSocket-based peer discovery for WebTorrent clients.
 * Eliminates dependency on public trackers for reliability.
 * 
 * Features:
 * - WebSocket (WSS) support for browser clients
 * - UDP support for native BitTorrent clients
 * - HTTP support for legacy clients
 * - Peer statistics and monitoring
 * 
 * Run with: npm start
 */

import { Server } from 'bittorrent-tracker';

const PORT = parseInt(process.env.PORT || '8000');
const STATS_INTERVAL = parseInt(process.env.STATS_INTERVAL || '60000'); // Log stats every 60s

// Create tracker server with all protocols enabled
const server = new Server({
    udp: true,      // Enable UDP tracker (for native clients)
    http: true,     // Enable HTTP tracker
    ws: true,       // Enable WebSocket tracker (for WebTorrent)
    stats: true,    // Enable stats endpoint
    trustProxy: true, // Trust X-Forwarded-For for proxied requests
    filter: function (infoHash, params, cb) {
        // Allow all torrents (no filtering)
        // You can add filtering logic here if needed
        cb(null);
    }
});

// Track statistics
let stats = {
    announces: 0,
    scrapes: 0,
    startTime: Date.now(),
};

server.on('error', (err) => {
    console.error('[Tracker] Error:', err.message);
});

server.on('warning', (err) => {
    console.warn('[Tracker] Warning:', err.message);
});

server.on('listening', () => {
    console.log('');
    console.log('🌐 IAMT BitTorrent Tracker Running!');
    console.log('');
    console.log(`   WebSocket: ws://0.0.0.0:${PORT}`);
    console.log(`   HTTP:      http://0.0.0.0:${PORT}/announce`);
    console.log(`   Stats:     http://0.0.0.0:${PORT}/stats`);
    console.log('');
    console.log('All WebTorrent clients can use this tracker for peer discovery.');
    console.log('');
});

server.on('start', (addr) => {
    stats.announces++;
    console.log(`[Tracker] Peer started: ${addr}`);
});

server.on('complete', (addr) => {
    console.log(`[Tracker] Download complete: ${addr}`);
});

server.on('stop', (addr) => {
    console.log(`[Tracker] Peer stopped: ${addr}`);
});

server.on('update', (addr) => {
    stats.announces++;
});

// Periodic stats logging
setInterval(() => {
    const torrents = server.torrents ? Object.keys(server.torrents).length : 0;
    let totalPeers = 0;
    let totalSeeds = 0;
    
    if (server.torrents) {
        for (const hash of Object.keys(server.torrents)) {
            const torrent = server.torrents[hash];
            if (torrent.peers) {
                totalPeers += Object.keys(torrent.peers).length;
            }
            if (torrent.complete) {
                totalSeeds += torrent.complete;
            }
        }
    }
    
    const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
    console.log(`[Stats] Torrents: ${torrents} | Peers: ${totalPeers} | Seeds: ${totalSeeds} | Announces: ${stats.announces} | Uptime: ${uptime}s`);
}, STATS_INTERVAL);

// Start the server
server.listen(PORT, '0.0.0.0', () => {
    // Listening callback already handled above
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[Tracker] Shutting down...');
    server.close(() => {
        console.log('[Tracker] Closed.');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n[Tracker] Shutting down...');
    server.close(() => {
        console.log('[Tracker] Closed.');
        process.exit(0);
    });
});
