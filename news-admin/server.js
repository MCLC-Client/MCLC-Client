const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3001;
const NEWS_FILE = path.join(__dirname, 'news.json');

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
app.use(express.static(path.join(__dirname, 'public')));

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

app.listen(PORT, () => {
    console.log(`News Admin Server running on port ${PORT}`);
});
