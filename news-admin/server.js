const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

// Helper to get local IP addresses
function getLocalIPs() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(interfaces)) {
        for (const intf of interfaces[name]) {
            if (intf.family === 'IPv4' && !intf.internal) {
                addresses.push(intf.address);
            }
        }
    }
    return addresses;
}

const PORT = process.env.PORT || 3001;
const NEWS_FILE = path.join(__dirname, 'news.json');
const ANALYTICS_FILE = path.join(__dirname, 'analytics.json');

// --- Analytics Storage ---
const activeSessions = new Map();

let stats = {
    downloads: {
        mod: {},
        resourcepack: {},
        shader: {},
        modpack: {}
    },
    launchesPerDay: {},
    clientVersions: {},
    software: {
        client: {},
        server: {}
    },
    gameVersions: {
        client: {},
        server: {}
    }
};

// --- Load analytics ---
if (fs.existsSync(ANALYTICS_FILE)) {
    try {
        const loaded = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
        // Migration: older format
        if (loaded.totalDownloads && !loaded.downloads) {
            stats.downloads.mod = loaded.totalDownloads;
            stats.launchesPerDay = loaded.launchesPerDay || {};
            stats.clientVersions = loaded.clientVersions || {};
        } else {
            stats = { ...stats, ...loaded };
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

setInterval(saveAnalytics, 30 * 1000);

// --- Socket.IO Logic ---
io.on('connection', (socket) => {
    activeSessions.set(socket.id, {
        version: 'unknown',
        os: 'unknown',
        isPlaying: false,
        instance: null,
        startTime: Date.now()
    });

    emitLiveStats();

    socket.on('register', (data) => {
        const session = activeSessions.get(socket.id);
        if (session) {
            session.version = data.version || 'unknown';
            session.os = data.os || 'unknown';
            session.username = data.username || 'Anonymous';
            session.uuid = data.uuid || null;
            activeSessions.set(socket.id, session);
        }
        if (data.version) {
            stats.clientVersions[data.version] = (stats.clientVersions[data.version] || 0) + 1;
        }
        emitLiveStats();
    });

    socket.on('update-status', (data) => {
        const session = activeSessions.get(socket.id);
        if (session) {
            if (data.isPlaying && !session.isPlaying) {
                const today = new Date().toISOString().split('T')[0];
                stats.launchesPerDay[today] = (stats.launchesPerDay[today] || 0) + 1;
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
        io.to('admin').emit('live-update', {
            live: getLiveStats(),
            persistent: stats
        });
    });

    socket.on('track-creation', (data) => {
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

    socket.on('track-download', (data) => {
        const type = data.type || 'mod';
        const key = data.name || data.id || 'unknown';
        const session = activeSessions.get(socket.id);
        const username = data.username || (session ? session.username : 'Anonymous');

        if (!stats.downloads[type]) stats.downloads[type] = {};

        if (key) {
            stats.downloads[type][key] = (stats.downloads[type][key] || 0) + 1;
            saveAnalytics();

            io.to('admin').emit('new-download', { ...data, username });
            io.to('admin').emit('live-update', {
                live: getLiveStats(),
                persistent: stats
            });
        }
    });

    socket.on('admin-subscribe', (password) => {
        if (password === ADMIN_PASSWORD) {
            socket.join('admin');
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
        if (session.version && session.version !== 'unknown') {
            activeUsers++;
            if (session.isPlaying) {
                playingUsers++;
                if (session.instance) {
                    playingInstances[session.instance] = (playingInstances[session.instance] || 0) + 1;
                }
            }
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
        persistent: stats
    });
}

// --- Multer Storage ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());

// Static paths
const websitePath = fs.existsSync(path.join(__dirname, 'website'))
    ? path.join(__dirname, 'website')
    : path.join(__dirname, '../website');
const adminPublicPath = fs.existsSync(path.join(__dirname, 'public'))
    ? path.join(__dirname, 'public')
    : path.join(__dirname, 'news-admin/public');
const codesDir = path.join(__dirname, 'codes');
if (!fs.existsSync(codesDir)) fs.mkdirSync(codesDir, { recursive: true });

app.use(express.static(websitePath));
app.use(express.static(adminPublicPath));
app.use('/codes', express.static(codesDir));

console.log(`[Static] Serving website from: ${path.resolve(websitePath)}`);
console.log(`[Static] Serving admin from: ${path.resolve(adminPublicPath)}`);
console.log(`[Static] Serving codes from: ${path.resolve(codesDir)}`);

// --- Data file setup ---
if (!fs.existsSync(NEWS_FILE)) {
    fs.writeFileSync(NEWS_FILE, JSON.stringify([], null, 2));
}

// --- News DB helpers ---
const getNews = () => JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8'));
const saveNews = (data) => fs.writeFileSync(NEWS_FILE, JSON.stringify(data, null, 2));

// --- Auth ---
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// --- Routes ---

app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const protocol = req.protocol;
    const host = req.get('host');
    const fullUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    res.json({ success: true, url: fullUrl });
});

app.get('/news.json', (req, res) => {
    res.json(getNews());
});

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
    console.log(`[News] POST /api/news received. Items: ${news ? news.length : 'null'}, Password provided: ${!!password}`);

    if (password !== ADMIN_PASSWORD) {
        console.warn(`[News] Unauthorized! Password mismatch.`);
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        saveNews(news);
        console.log(`[News] Saved ${news.length} items to ${NEWS_FILE}`);
        const verify = getNews();
        console.log(`[News] Verify: file now contains ${verify.length} items`);
        res.json({ success: true });
    } catch (err) {
        console.error(`[News] Write error:`, err);
        res.status(500).json({ success: false, error: 'Failed to write news: ' + err.message });
    }
});

// --- MODPACK CODES SYSTEM ---
try {
    const initCodesSystem = require('./codes_system');
    initCodesSystem(app);
} catch (err) {
    console.error('Failed to initialize codes system:', err);
}

// --- Analytics API ---
app.get('/api/analytics', (req, res) => {
    if (req.query.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
    res.json({
        live: getLiveStats(),
        persistent: stats
    });
});

// --- Start Server and Print Pretty Link Information ---
server.listen(PORT, () => {
    let protocol = 'http';
    let showPort = PORT !== 80 && PORT !== 443;
    const localURLs = [
        `http://localhost:${PORT}`,
        ...getLocalIPs().map(ip => `http://${ip}:${PORT}`)
    ];
    console.log(`\n-------------------------------------`);
    console.log(`News Admin Server (with Socket.IO) running!`);
    console.log(``);
    console.log(`Website available at:`);
    localURLs.forEach(url => console.log(`>  ${url}`));
    console.log(``);
    console.log(`Admin dashboard and API are now available.`);
    console.log(`-------------------------------------\n`);
});
