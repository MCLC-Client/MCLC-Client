const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const passport = require('passport');
require('dotenv').config();

const pool = require('./database');
const http = require('http');
const { Server } = require("socket.io");
require('./passport-setup'); // Import passport configuration
const codesSystem = require('./codes_system');

const app = express();
app.set('trust proxy', 1); // Trust the Plesk proxy
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const NEWS_FILE = path.join(__dirname, 'news.json');
const ANALYTICS_FILE = path.join(__dirname, 'analytics.json');

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session Config
app.use(session({
    secret: process.env.SESSION_SECRET || 'mclc-secret-key-change-me',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Only secure in production
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Passport Init
app.use(passport.initialize());
app.use(passport.session());

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
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- Routes ---

// Auth Routes
app.get('/auth/google', (req, res, next) => {
    if (req.query.returnTo) {
        req.session.returnTo = req.query.returnTo;
    }
    next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        res.redirect(returnTo);
    }
);

app.get('/auth/logout', (req, res) => {
    const returnTo = req.query.returnTo || '/';
    req.logout((err) => {
        if (err) return next(err);
        res.redirect(returnTo);
    });
});

app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ loggedIn: true, user: req.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// Middleware to check authentication
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
}

function ensureAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Forbidden' });
}

// 1. Extensions API
app.get('/api/extensions', async (req, res) => {
    const { search } = req.query;
    try {
        const [extensions] = await pool.query(`
            SELECT extensions.*, users.username as developer 
            FROM extensions 
            LEFT JOIN users ON extensions.user_id = users.id 
            WHERE extensions.status = "approved"
            ${search ? 'AND (extensions.name LIKE ? OR extensions.description LIKE ?)' : ''}
        `, search ? [`%${search}%`, `%${search}%`] : []);
        res.json(extensions);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/extensions/upload', ensureAuthenticated, upload.fields([
    { name: 'extensionFile', maxCount: 1 },
    { name: 'bannerImage', maxCount: 1 }
]), async (req, res) => {
    const files = req.files;
    if (!files || !files.extensionFile) return res.status(400).json({ error: 'No extension file uploaded' });

    const { name, description, identifier, summary, type } = req.body;
    const filePath = '/uploads/' + files.extensionFile[0].filename;
    const bannerPath = files.bannerImage ? '/uploads/' + files.bannerImage[0].filename : null;

    try {
        await pool.query(
            'INSERT INTO extensions (user_id, name, identifier, summary, description, type, file_path, banner_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, name, identifier, summary, description, type || 'extension', filePath, bannerPath]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Upload Error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Identifier already exists' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/extensions/i/:identifier', async (req, res) => {
    const { identifier } = req.params;
    try {
        const [rows] = await pool.query(`
            SELECT extensions.*, users.username as developer, users.avatar as developer_avatar
            FROM extensions 
            LEFT JOIN users ON extensions.user_id = users.id 
            WHERE extensions.identifier = ? AND extensions.status = "approved"
        `, [identifier]);

        if (rows.length === 0) return res.status(404).json({ error: 'Extension not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// User Specific Endpoints
app.get('/api/user/extensions', ensureAuthenticated, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM extensions WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/user/update', ensureAuthenticated, async (req, res) => {
    const { username, bio, avatar } = req.body;
    try {
        await pool.query(
            'UPDATE users SET username = ?, bio = ?, avatar = ? WHERE id = ?',
            [username, bio, avatar, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Admin Extension Endpoints
app.get('/api/admin/extensions/pending', ensureAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT extensions.*, users.username as developer 
            FROM extensions 
            LEFT JOIN users ON extensions.user_id = users.id 
            WHERE status = "pending"
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/admin/extensions/:id/:action', ensureAdmin, async (req, res) => {
    const { id, action } = req.params;
    const status = action === 'approve' ? 'approved' : 'rejected';
    try {
        await pool.query('UPDATE extensions SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 2. Original Upload API (Compatibility)
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
    console.log(`[News] POST /api/news received. Items: ${news ? news.length : 'null'}, Password provided: ${!!password}`);

    if (password !== ADMIN_PASSWORD) {
        console.warn(`[News] Unauthorized! Password mismatch.`);
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        saveNews(news);
        console.log(`[News] Saved ${news.length} items to ${NEWS_FILE}`);
        // Verify the save
        const verify = getNews();
        console.log(`[News] Verify: file now contains ${verify.length} items`);
        res.json({ success: true });
    } catch (err) {
        console.error(`[News] Write error:`, err);
        res.status(500).json({ success: false, error: 'Failed to write news: ' + err.message });
    }
});

// Serve landing page (current directory or website/ subdir)
const websitePath = fs.existsSync(path.join(__dirname, 'website'))
    ? path.join(__dirname, 'website')
    : __dirname;

const adminPublicPath = fs.existsSync(path.join(__dirname, 'public'))
    ? path.join(__dirname, 'public')
    : path.join(__dirname, 'news-admin/public');

console.log(`[Static] Serving website from: ${path.resolve(websitePath)}`);
console.log(`[Static] Serving admin from: ${path.resolve(adminPublicPath)}`);

app.use(express.static(websitePath));
app.use(express.static(adminPublicPath));

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Dynamic route for individual extension pages
app.get('/extensions/:identifier', (req, res) => {
    // If the identifier corresponds to a file that exists, let express.static handle it
    // But since we want dynamic pages, we'll serve the template
    res.sendFile(path.join(__dirname, 'extension_detail.html'));
});

// Initialize Codes System
codesSystem(app, ADMIN_PASSWORD);

// Initialize news.json if not exists
if (!fs.existsSync(NEWS_FILE)) {
    fs.writeFileSync(NEWS_FILE, JSON.stringify([], null, 2));
}

// Simple text-based "database"
const getNews = () => JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8'));
const saveNews = (data) => fs.writeFileSync(NEWS_FILE, JSON.stringify(data, null, 2));

// Analytics API
app.get('/api/analytics', (req, res) => {
    if (req.query.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
    res.json({
        live: getLiveStats(),
        persistent: stats
    });
});

const { createTables } = require('./db_init');

server.listen(PORT, async () => {
    console.log(`News Admin Server (with Socket.IO, Auth, Extensions) running on port ${PORT}`);

    // Automatically initialize database tables
    try {
        await createTables();
    } catch (err) {
        console.error('[Database] Critical error during auto-init:', err.message);
    }
});
