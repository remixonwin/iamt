/**
 * Gun.js Relay Server
 * 
 * A production-ready relay server for syncing data across devices.
 * Deployed on Railway.app for persistent WebSocket connections.
 * 
 * Run locally with: node server.js
 */

const express = require('express');
const cors = require('cors');
const Gun = require('gun');
const http = require('http');

const PORT = process.env.PORT || 8765;
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();

// Enable CORS for all origins (required for Gun.js)
app.use(cors({
    origin: true,
    credentials: true,
}));

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'IAMT Gun.js Relay Server',
        environment: NODE_ENV,
        gun: '/gun',
        uptime: Math.floor(process.uptime()) + 's',
        peers: gun?._.opt?.peers ? Object.keys(gun._.opt.peers).length : 0,
    });
});

// Health check for Railway
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Gun.js with the server
// In production, we don't persist to disk (Railway has ephemeral storage)
const gun = Gun({
    web: server,
    file: NODE_ENV === 'production' ? false : 'data', // No file persistence in production
    radisk: NODE_ENV === 'production' ? false : true, // Disable radisk in production
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🚀 IAMT Gun.js Relay Server Running!');
    console.log('');
    console.log(`   Environment: ${NODE_ENV}`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Gun endpoint: /gun`);
    console.log('');
    if (NODE_ENV === 'production') {
        console.log('Running in production mode (no disk persistence)');
    } else {
        console.log('Running in development mode (data persisted to ./data)');
    }
    console.log('');
});
