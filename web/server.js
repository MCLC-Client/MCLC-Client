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
require('./passport-setup');
const codesSystem = require('./codes_system');

const app = express();
app.set('trust proxy', 1);
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

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'mclc-secret-key-change-me',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

const activeSessions = new Map();

let stats = {
    downloads: {
        mod: {},
        resourcepack: {},
        shader: {},
        modpack: {}
    },
    launchesPerDay: {}, // { "2023-10-27": 150 }
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

if (fs.existsSync(ANALYTICS_FILE)) {
    try {
        const loaded = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
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
        persistent: stats
    });
}

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
    try {
        if (req.isAuthenticated()) {
            return res.json({ loggedIn: true, user: req.user });
        }
        res.json({ loggedIn: false });
    } catch (err) {
        console.error('[API Error] /api/user failed:', err);
        res.status(500).json({ error: 'Auth check failed', details: err.message });
    }
});

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
        console.error('[API Error] Fetch Extensions failed:', err);
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

app.post('/api/extensions/upload', ensureAuthenticated, upload.fields([
    { name: 'extensionFile', maxCount: 1 },
    { name: 'bannerImage', maxCount: 1 }
]), async (req, res) => {
    const files = req.files;
    if (!files || !files.extensionFile) return res.status(400).json({ error: 'No extension file uploaded' });

    const { name, description, identifier, summary, type, visibility, version } = req.body;
    const bannerFilename = files.bannerImage ? files.bannerImage[0].filename : null;
    const extensionFilename = files.extensionFile[0].filename;

    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const [extResult] = await connection.query(
                'INSERT INTO extensions (user_id, name, identifier, summary, description, type, visibility, banner_path, file_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [req.user.id, name, identifier, summary, description, type || 'extension', visibility || 'public', bannerFilename, extensionFilename]
            );
            const extensionId = extResult.insertId;

            await connection.query(
                'INSERT INTO extension_versions (extension_id, version, changelog, file_path, downloads, status) VALUES (?, ?, ?, ?, ?, ?)',
                [extensionId, version || '1.0.0', 'Initial upload', extensionFilename, 0, 'pending']
            );

            await connection.commit();
            res.json({ success: true, extensionId });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Upload Error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Identifier already exists' });
        }
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

app.post('/api/extensions/update/:id', ensureAuthenticated, upload.fields([
    { name: 'bannerImage', maxCount: 1 }
]), async (req, res) => {
    const { id } = req.params;
    const { name, description, summary, type, visibility } = req.body;
    const files = req.files;

    try {
        const [rows] = await pool.query('SELECT user_id FROM extensions WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Extension not found' });
        if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const bannerPath = files && files.bannerImage ? files.bannerImage[0].filename : null;

        if (req.user.role === 'admin') {
            let updateFields = [];
            let queryParams = [];
            if (name) { updateFields.push('name = ?'); queryParams.push(name); }
            if (description) { updateFields.push('description = ?'); queryParams.push(description); }
            if (summary) { updateFields.push('summary = ?'); queryParams.push(summary); }
            if (bannerPath) { updateFields.push('banner_path = ?'); queryParams.push(bannerPath); }
            if (type) { updateFields.push('type = ?'); queryParams.push(type); }
            if (visibility) { updateFields.push('visibility = ?'); queryParams.push(visibility); }

            if (updateFields.length > 0) {
                queryParams.push(id);
                await pool.query(`UPDATE extensions SET ${updateFields.join(', ')} WHERE id = ?`, queryParams);
            }

            await pool.query('UPDATE extensions SET status = "pending" WHERE id = ? AND status = "action_required"', [id]);

            res.json({ success: true, message: 'Updated directly (Admin)' });
        } else {
            await pool.query(
                'INSERT INTO extension_metadata_drafts (extension_id, name, summary, description, banner_path, status) VALUES (?, ?, ?, ?, ?, ?)',
                [id, name, summary, description, bannerPath, 'pending']
            );
            await pool.query('UPDATE extensions SET status = "pending" WHERE id = ? AND status = "action_required"', [id]);

            res.json({ success: true, message: 'Metadata draft submitted for review' });
        }
    } catch (err) {
        console.error('Update (Draft) Error:', err);
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

app.post('/api/extensions/:id/version', ensureAuthenticated, upload.single('extensionFile'), async (req, res) => {
    const { id } = req.params;
    const { version, changelog } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const [rows] = await pool.query('SELECT user_id FROM extensions WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Extension not found' });
        if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await pool.query(
            'INSERT INTO extension_versions (extension_id, version, changelog, file_path, status) VALUES (?, ?, ?, ?, ?)',
            [id, version, changelog, req.file.filename, 'pending']
        );
        await pool.query('UPDATE extensions SET status = "pending" WHERE id = ? AND status = "action_required"', [id]);

        res.json({ success: true });
    } catch (err) {
        console.error('Version Upload Error:', err);
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

app.get('/api/extensions/i/:identifier', async (req, res) => {
    const { identifier } = req.params;
    try {
        const [rows] = await pool.query(`
            SELECT extensions.*, users.username as developer, users.avatar as developer_avatar
            FROM extensions 
            LEFT JOIN users ON extensions.user_id = users.id 
            WHERE extensions.identifier = ?
        `, [identifier]);

        if (rows.length === 0) return res.status(404).json({ error: 'Extension not found' });
        const extension = rows[0];

        const [versions] = await pool.query(
            'SELECT * FROM extension_versions WHERE extension_id = ? AND status = "approved" ORDER BY created_at DESC',
            [extension.id]
        );

        res.json({ ...extension, versions });
    } catch (err) {
        console.error('[API Error] Fetch Extension Detail failed:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/extensions/:id/versions', ensureAuthenticated, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM extension_versions WHERE extension_id = ? ORDER BY created_at DESC',
            [req.params.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.delete('/api/extensions/versions/:vid', ensureAuthenticated, async (req, res) => {
    const vid = req.params.vid;
    try {
        const [ext] = await pool.query(`
            SELECT extensions.user_id FROM extensions
            JOIN extension_versions ON extensions.id = extension_versions.extension_id
            WHERE extension_versions.id = ?
        `, [vid]);

        if (ext.length === 0) return res.status(404).json({ error: 'Version not found' });
        if (ext[0].user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await pool.query('DELETE FROM extension_versions WHERE id = ?', [vid]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.delete('/api/extensions/:id', ensureAuthenticated, async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [ext] = await connection.query('SELECT user_id FROM extensions WHERE id = ?', [id]);
        if (ext.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Extension not found' });
        }

        if (ext[0].user_id !== req.user.id && req.user.role !== 'admin') {
            await connection.rollback();
            return res.status(403).json({ error: 'Unauthorized: You do not own this extension' });
        }

        await connection.query('DELETE FROM extension_versions WHERE extension_id = ?', [id]);
        await connection.query('DELETE FROM extension_metadata_drafts WHERE extension_id = ?', [id]);
        await connection.query('DELETE FROM extensions WHERE id = ?', [id]);

        await connection.commit();
        res.json({ success: true, message: 'Extension deleted successfully' });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('[MCLC] Error deleting extension:', err);
        res.status(500).json({ error: 'Database error while deleting' });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/user/extensions', ensureAuthenticated, async (req, res) => {
    try {
        const isAdmin = req.user && req.user.role === 'admin';
        const query = isAdmin
            ? 'SELECT * FROM extensions ORDER BY created_at DESC'
            : 'SELECT * FROM extensions WHERE user_id = ? ORDER BY created_at DESC';

        const params = isAdmin ? [] : [req.user.id];

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('[API Error] /api/user/extensions failed:', err);
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

app.get('/api/user/notifications', ensureAuthenticated, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/notifications/read/:id', ensureAuthenticated, async (req, res) => {
    try {
        await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/notifications/read-all', ensureAuthenticated, async (req, res) => {
    try {
        await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/user/update', ensureAuthenticated, upload.single('avatarFile'), async (req, res) => {
    const { username, bio, avatar } = req.body;
    let finalAvatar = avatar;

    if (req.file) {
        finalAvatar = req.file.filename;
    }

    try {
        await pool.query(
            'UPDATE users SET username = ?, bio = ?, avatar = ? WHERE id = ?',
            [username, bio, finalAvatar, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

app.get('/api/users/p/:username', async (req, res) => {
    try {
        const [userRows] = await pool.query('SELECT id, username, avatar, bio, role, created_at FROM users WHERE username = ?', [req.params.username]);
        if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });

        const user = userRows[0];
        const [extensions] = await pool.query('SELECT name, identifier, summary, banner_path, type, status FROM extensions WHERE user_id = ? AND status = "approved"', [user.id]);

        res.json({ user, extensions });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/admin/users', ensureAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, email, ip_address, role, last_login, banned, warn_count, created_at FROM users ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/admin/users/:id/:action', ensureAdmin, async (req, res) => {
    const { id, action } = req.params;
    const { reason, duration } = req.body;

    try {
        if (action === 'warn') {
            await pool.query('UPDATE users SET warn_count = warn_count + 1 WHERE id = ?', [id]);
            await pool.query('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)', [id, `You have received a warning. Reason: ${reason || 'No reason specified'}`, 'warning']);
        } else if (action === 'ban') {
            let expires = null;
            if (duration) {
                expires = new Date();
                expires.setHours(expires.getHours() + parseInt(duration));
            }
            await pool.query('UPDATE users SET banned = TRUE, ban_reason = ?, ban_expires = ? WHERE id = ?', [reason, expires, id]);
            await pool.query('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)', [id, `You have been banned. Reason: ${reason}`, 'error']);
        } else if (action === 'unban') {
            await pool.query('UPDATE users SET banned = FALSE, ban_reason = NULL, ban_expires = NULL WHERE id = ?', [id]);
            await pool.query('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)', [id, 'Your ban has been lifted.', 'success']);
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/admin/reset-stats', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        stats = {
            downloads: { mod: {}, resourcepack: {}, shader: {}, modpack: {} },
            launchesPerDay: {},
            clientVersions: {},
            software: { client: {}, server: {} },
            gameVersions: { client: {}, server: {} }
        };
        saveAnalytics();
        io.to('admin').emit('init-stats', {
            live: getLiveStats(),
            persistent: stats
        });
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
});

app.get('/api/admin/extensions/all', ensureAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT extensions.*, users.username as developer 
            FROM extensions 
            LEFT JOIN users ON extensions.user_id = users.id 
            ORDER BY created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/admin/extensions/pending', ensureAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT extensions.*, users.username as developer 
            FROM extensions 
            LEFT JOIN users ON extensions.user_id = users.id 
            WHERE extensions.status = "pending"
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/admin/drafts/pending', ensureAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT extension_metadata_drafts.*, extensions.name as original_name, users.username as developer
            FROM extension_metadata_drafts
            JOIN extensions ON extension_metadata_drafts.extension_id = extensions.id
            JOIN users ON extensions.user_id = users.id
            WHERE extension_metadata_drafts.status = "pending"
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/admin/drafts/:did/:action', ensureAdmin, async (req, res) => {
    const { did, action } = req.params;
    const { reason } = req.body;
    try {
        if (action === 'approve') {
            const [drafts] = await pool.query('SELECT * FROM extension_metadata_drafts WHERE id = ?', [did]);
            if (drafts.length === 0) return res.status(404).json({ error: 'Draft not found' });
            const draft = drafts[0];

            let updates = [];
            let params = [];
            if (draft.name) { updates.push('name = ?'); params.push(draft.name); }
            if (draft.summary) { updates.push('summary = ?'); params.push(draft.summary); }
            if (draft.description) { updates.push('description = ?'); params.push(draft.description); }
            if (draft.banner_path) { updates.push('banner_path = ?'); params.push(draft.banner_path); }

            if (updates.length > 0) {
                params.push(draft.extension_id);
                await pool.query(`UPDATE extensions SET ${updates.join(', ')} WHERE id = ?`, params);
            }

            await pool.query('UPDATE extension_metadata_drafts SET status = "approved" WHERE id = ?', [did]);
        } else {
            await pool.query('UPDATE extension_metadata_drafts SET status = "rejected" WHERE id = ?', [did]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/admin/versions/pending', ensureAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT extension_versions.*, extensions.name as extension_name, users.username as developer
            FROM extension_versions
            JOIN extensions ON extension_versions.extension_id = extensions.id
            JOIN users ON extensions.user_id = users.id
            WHERE extension_versions.status = "pending" AND extensions.status = "approved"
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/admin/versions/:vid/:action', ensureAdmin, async (req, res) => {
    const { vid, action } = req.params;
    const status = action === 'approve' ? 'approved' : 'rejected';
    try {
        await pool.query('UPDATE extension_versions SET status = ? WHERE id = ?', [status, vid]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.delete('/api/admin/extensions/:id', ensureAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM extensions WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/admin/extensions/:id/:action', ensureAdmin, async (req, res) => {
    const { id, action } = req.params;
    const { reason } = req.body;
    let status = 'pending';
    if (action === 'approve') status = 'approved';
    else if (action === 'reject') status = 'rejected';
    else if (action === 'action_required') status = 'action_required';

    try {
        await pool.query('UPDATE extensions SET status = ? WHERE id = ?', [status, id]);

        const [ext] = await pool.query('SELECT user_id, name FROM extensions WHERE id = ?', [id]);
        if (ext.length > 0) {
            const userId = ext[0].user_id;
            const name = ext[0].name;
            let msg = '';
            let type = 'info';

            if (status === 'approved') {
                msg = `Your extension "${name}" has been approved!`;
                type = 'success';
                await pool.query('UPDATE extension_versions SET status = "approved" WHERE extension_id = ? AND status = "pending"', [id]);
            } else if (status === 'rejected') {
                msg = `Your extension "${name}" was rejected. Reason: ${reason || 'No reason specified'}`;
                type = 'error';
            } else if (status === 'action_required') {
                msg = `Action required for your extension "${name}". Please check the feedback: ${reason || 'No reason specified'}`;
                type = 'warning';
            }

            await pool.query('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)', [userId, msg, type]);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[MCLC] Admin extension status update error:', err);
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

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

app.use((err, req, res, next) => {
    console.error(`[Server Error] ${req.method} ${req.url}:`, err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
    });
});

const websitePath = fs.existsSync(path.join(__dirname, 'website'))
    ? path.join(__dirname, 'website')
    : __dirname;

const adminPublicPath = fs.existsSync(path.join(__dirname, 'public'))
    ? path.join(__dirname, 'public')
    : path.join(__dirname, 'news-admin/public');

console.log(`[Static] Serving website from: ${path.resolve(websitePath)}`);
console.log(`[Static] Serving admin from: ${path.resolve(adminPublicPath)}`);

const staticOptions = {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        }
    }
};

app.use(express.static(websitePath, staticOptions));
app.use(express.static(adminPublicPath, staticOptions));

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.get('/extensions/:identifier', (req, res) => {
    res.sendFile(path.join(__dirname, 'extension_detail.html'), { headers: { 'Cache-Control': 'no-cache, must-revalidate' } });
});

codesSystem(app, ADMIN_PASSWORD);

if (!fs.existsSync(NEWS_FILE)) {
    fs.writeFileSync(NEWS_FILE, JSON.stringify([], null, 2));
}

const getNews = () => JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8'));
const saveNews = (data) => fs.writeFileSync(NEWS_FILE, JSON.stringify(data, null, 2));

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

    try {
        await createTables();
    } catch (err) {
        console.error('[Database] Critical error during auto-init:', err.message);
    }
});
