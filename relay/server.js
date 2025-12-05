/**
 * Gun.js Relay Server
 * 
 * A local relay server for syncing data across devices.
 * Run with: node server.js
 * 
 * Access at: http://localhost:8765/
 */

const express = require('express');
const cors = require('cors');
const Gun = require('gun');
const http = require('http');

const PORT = process.env.PORT || 8765;

const app = express();

// Enable CORS for all origins
app.use(cors({
    origin: true,
    credentials: true,
}));

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'IAMT Gun.js Relay Server',
        gun: '/gun',
        peers: gun._.opt.peers ? Object.keys(gun._.opt.peers).length : 0,
    });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Gun.js with the server
const gun = Gun({
    web: server,
    file: 'data', // Persist data to disk
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🚀 IAMT Gun.js Relay Server Running!');
    console.log('');
    console.log(`   Local:   http://localhost:${PORT}/gun`);
    console.log(`   Network: http://<your-ip>:${PORT}/gun`);
    console.log('');
    console.log('All devices on your network can connect to this relay.');
    console.log('Data is persisted to ./data folder.');
    console.log('');
});
