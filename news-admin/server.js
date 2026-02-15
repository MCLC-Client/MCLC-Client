const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3001;
const NEWS_FILE = path.join(__dirname, 'news.json');
const ANALYTICS_FILE = path.join(__dirname, 'analytics.json');

// --- Analytics Storage ---
// In-memory active sessions
// Map<SocketID, { version: string, os: string, isPlaying: boolean, instance: string, startTime: number }>
const activeSessions = new Map();

// Persistent stats structure
let stats = {
    // Downloads by category
    downloads: {
        mod: {},        // { "Fabric API": 120 }
        resourcepack: {},
        shader: {},
        modpack: {}
    },
    // Daily tracking
    launchesPerDay: {}, // { "2023-10-27": 150 }
    // User base
    clientVersions: {}, // { "1.0.0": 10 }
    software: {
        client: {}, // { "Fabric": 10, "Vanilla": 5 }
        server: {}
    },
    gameVersions: {
        client: {}, // { "1.21": 8 }
        server: {}
    }
};

// Load analytics
if (fs.existsSync(ANALYTICS_FILE)) {
    try {
        const loaded = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
        // Migration: If old format, convert
        if (loaded.totalDownloads && !loaded.downloads) {
            stats.downloads.mod = loaded.totalDownloads; // Assume old are mods
            stats.launchesPerDay = loaded.launchesPerDay || {};
            stats.clientVersions = loaded.clientVersions || {};
        } else {
            stats = { ...stats, ...loaded }; // Merge to ensure structure
            // Ensure new structures exist
            if (!stats.software) stats.software = { client: {}, server: {} };
            if (!stats.gameVersions) stats.gameVersions = { client: {}, server: {} };
        }
    } catch (e) {
        console.error("Failed to load analytics:", e);
    }
} else {
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(stats, null, 2));
}

const saveAnalytics = () => {
    fs.writeFile(ANALYTICS_FILE, JSON.stringify(stats, null, 2), (err) => {
        if (err) console.error("Error saving analytics:", err);
    });
};

// Save every 30 seconds
setInterval(saveAnalytics, 30 * 1000);

// --- Socket.IO Logic ---
io.on('connection', (socket) => {
    // Default session data
    activeSessions.set(socket.id, {
        version: 'unknown',
        os: 'unknown',
        isPlaying: false,
        instance: null,
        startTime: Date.now()
    });

    // Send initial live stats to THIS client (if they are admin) or just broadcast update to admins
    // Actually we should just emit live stats to admins whenever connection changes
    emitLiveStats();

    // 1. Client Register (On Startup)
    socket.on('register', (data) => {
        const session = activeSessions.get(socket.id);
        if (session) {
            session.version = data.version || 'unknown';
            session.os = data.os || 'unknown';
            session.username = data.username || 'Anonymous'; // Store username
            session.uuid = data.uuid || null;
            activeSessions.set(socket.id, session);
        }

        // Update persistent version stats
        if (data.version) {
            stats.clientVersions[data.version] = (stats.clientVersions[data.version] || 0) + 1;
        }

        emitLiveStats();
    });

    // 2. Client Status Update (isPlaying)
    socket.on('update-status', (data) => {
        const session = activeSessions.get(socket.id);
        if (session) {
            // Check if we just started playing
            if (data.isPlaying && !session.isPlaying) {
                // Persistent tracking on Launch
                const today = new Date().toISOString().split('T')[0];
                stats.launchesPerDay[today] = (stats.launchesPerDay[today] || 0) + 1;

                // Track Software and Game Version
                const mode = data.mode === 'server' ? 'server' : 'client';
                if (data.software) {
                    stats.software[mode][data.software] = (stats.software[mode][data.software] || 0) + 1;
                }
                if (data.gameVersion) {
                    stats.gameVersions[mode][data.gameVersion] = (stats.gameVersions[mode][data.gameVersion] || 0) + 1;
                }
                saveAnalytics();
            }

            session.isPlaying = data.isPlaying;
            session.instance = data.instance || null;
            activeSessions.set(socket.id, session);
        }
        emitLiveStats();
        // Also emit persistent stats update because launchesPerDay changed
        io.to('admin').emit('live-update', {
            live: getLiveStats(),
            persistent: stats
        });
    });

    // 2.5 Track Creation (e.g. Server created in Dashboard)
    socket.on('track-creation', (data) => {
        // data: { software: "paper", version: "1.21.1", mode: "server" }
        const mode = data.mode === 'server' ? 'server' : 'client';
        console.log(`[Analytics] Track Creation (${mode}):`, data.software, data.version);
        if (data.software) {
            stats.software[mode][data.software] = (stats.software[mode][data.software] || 0) + 1;
        }
        if (data.version) {
            stats.gameVersions[mode][data.version] = (stats.gameVersions[mode][data.version] || 0) + 1;
        }
        saveAnalytics();

        io.to('admin').emit('live-update', {
            live: getLiveStats(),
            persistent: stats
        });
    });

    // 3. Track Download
    socket.on('track-download', (data) => {
        // data: { type: "mod", name: "Fabric API", id: "P7dR8mSH", username: "..." }
        const type = data.type || 'mod';
        const key = data.name || data.id || 'unknown';
        const session = activeSessions.get(socket.id);
        const username = data.username || (session ? session.username : 'Anonymous');

        // Initialize category if missing (safety)
        if (!stats.downloads[type]) stats.downloads[type] = {};

        if (key) {
            stats.downloads[type][key] = (stats.downloads[type][key] || 0) + 1;

            saveAnalytics();

            // Notify admins - Send FULL stats update to keep UI in sync
            // Attach username to the event for the real-time log
            io.to('admin').emit('new-download', { ...data, username });
            io.to('admin').emit('live-update', {
                live: getLiveStats(),
                persistent: stats
            });
        }
    });

    // 4. Admin Subscribe
    socket.on('admin-subscribe', (password) => {
        if (password === ADMIN_PASSWORD) {
            socket.join('admin');
            // Send full initial state
            socket.emit('init-stats', {
                live: getLiveStats(),
                persistent: stats
            });
        } else {
            socket.emit('error', 'Invalid password');
        }
    });

    socket.on('disconnect', () => {
        activeSessions.delete(socket.id);
        emitLiveStats();
    });
});

function getLiveStats() {
    let activeUsers = 0;
    let playingUsers = 0;
    const versions = {};
    const playingInstances = {};

    activeSessions.forEach((session) => {
        // Only count as active users those who have registered (launcher client)
        if (session.version && session.version !== 'unknown') {
            activeUsers++;
            if (session.isPlaying) {
                playingUsers++;
                if (session.instance) {
                    playingInstances[session.instance] = (playingInstances[session.instance] || 0) + 1;
                }
            }
        }
        if (session.version && session.version !== 'unknown') {
            versions[session.version] = (versions[session.version] || 0) + 1;
        }
    });

    return {
        activeUsers,
        playingUsers,
        versions,
        playingInstances
    };
}

function emitLiveStats() {
    io.to('admin').emit('live-update', {
        live: getLiveStats(),
        persistent: stats // Always send persistent stats too for simplicity
    });
}


// Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Safe filename: timestamp-original.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(bodyParser.json());

// 1. Serve the landing page website 
// We check both the current dir and the parent dir to support different server layouts
const websitePath = fs.existsSync(path.join(__dirname, 'website'))
    ? path.join(__dirname, 'website')
    : path.join(__dirname, '../website');

const adminPublicPath = fs.existsSync(path.join(__dirname, 'public'))
    ? path.join(__dirname, 'public')
    : path.join(__dirname, 'news-admin/public');

console.log(`[Static] Serving website from: ${path.resolve(websitePath)}`);
console.log(`[Static] Serving admin from: ${path.resolve(adminPublicPath)}`);

app.use(express.static(websitePath));
app.use(express.static(adminPublicPath));

// Initialize news.json if not exists
if (!fs.existsSync(NEWS_FILE)) {
    fs.writeFileSync(NEWS_FILE, JSON.stringify([], null, 2));
}

// Simple text-based "database"
const getNews = () => JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8'));
const saveNews = (data) => fs.writeFileSync(NEWS_FILE, JSON.stringify(data, null, 2));

// Password (change this!)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// Routes

// 1. Upload API
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    // Return the URL to access the file
    // Assumes server is reachable at same host/port as this request
    // Or we return a relative path and the frontend constructs full URL?
    // Let's return full URL based on request host for convenience
    const protocol = req.protocol;
    const host = req.get('host');
    const fullUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    res.json({ success: true, url: fullUrl });
});

// 2. Public endpoint for Launcher
app.get('/news.json', (req, res) => {
    res.json(getNews());
});

// 3. Admin API
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true, token: 'logged-in' });
    } else {
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});

app.get('/api/news', (req, res) => {
    res.json(getNews());
});

app.post('/api/news', (req, res) => {
    const { news, password } = req.body;
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    saveNews(news);
    res.json({ success: true });
});

// Analytics API (Optional, for polling if socket fails)
app.get('/api/analytics', (req, res) => {
    if (req.query.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
    res.json({
        live: getLiveStats(),
        persistent: stats
    });
});

server.listen(PORT, () => {
    console.log(`News Admin Server (with Socket.IO) running on port ${PORT}`);
});
