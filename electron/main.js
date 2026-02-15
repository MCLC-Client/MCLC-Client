const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const dns = require('dns');

// Fix for IPv6 connection timeouts (ETIMEDOUT) on some networks
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

// MUST be called before app.whenReady
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'app-media',
        privileges: {
            secure: true,
            standard: true,
            supportFetchAPI: true,
            bypassCSP: true,
            corsEnabled: true,
            stream: true
        }
    }
]);

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 900,
        minHeight: 600,
        title: 'MCLC',
        frame: false, // Custom titlebar support
        icon: path.join(__dirname, '../resources/icon.png'), // Set App Icon
        backgroundColor: '#121212',
        webPreferences: {
            preload: path.join(__dirname, '../backend/preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false // Required for some heavy node modules if needed, but try keep true if possible
        },
    });

    console.log('[Main] Preload script configured.');

    // Load the backend handlers
    console.log('[Main] Registering handlers...');
    console.log('[Main] Registering auth handler...');
    require('../backend/handlers/auth')(ipcMain, mainWindow);
    console.log('[Main] Registering instances handler...');
    require('../backend/handlers/instances')(ipcMain, mainWindow); // Load instances logic
    console.log('[Main] Registering launcher handler...');
    require('../backend/handlers/launcher')(ipcMain, mainWindow);
    require('../backend/handlers/servers')(ipcMain, mainWindow);
    console.log('[Main] Registering Modrinth handler...');
    require('../backend/handlers/modrinth')(ipcMain, mainWindow);
    console.log('[Main] Registering data handler...');
    require('../backend/handlers/data')(ipcMain);
    console.log('[Main] Registering settings handler...');
    require('../backend/handlers/settings')(ipcMain);
    console.log('[Main] Registering skins handler...');
    try {
        require('../backend/handlers/skins')(ipcMain, mainWindow);
        console.log('[Main] Skins handler registered successfully.');
    } catch (e) {
        console.error('[Main] Failed to register skins handler:', e);
    }
    require('../backend/handlers/java')(ipcMain);
    const discord = require('../backend/handlers/discord');

    // Initialize Discord RPC
    discord.initRPC();

    // In production, load the built index.html. In dev, load localhost.
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Window controls
    ipcMain.on('window-minimize', () => mainWindow.minimize());
    ipcMain.on('window-maximize', () => {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    });
    ipcMain.on('window-close', () => mainWindow.close());

    // Notify renderer of window state changes
    mainWindow.on('maximize', () => mainWindow.webContents.send('window-state', true));
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-state', false));
}

app.whenReady().then(() => {
    // Register custom protocol for local media
    // Use app-media:///C:/... format
    protocol.handle('app-media', (request) => {
        try {
            const url = new URL(request.url);
            // pathname will be /C:/Users/... or /Users/...
            let decodedPath = decodeURIComponent(url.pathname);

            // Normalize path for Windows: /C:/ -> C:/
            if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(decodedPath)) {
                decodedPath = decodedPath.slice(1);
            }

            // Defensive: Check if file exists to avoid ERR_FILE_NOT_FOUND crash
            if (!decodedPath || decodedPath === '/' || !fs.existsSync(decodedPath)) {
                return new Response('Not Found', { status: 404 });
            }

            // Ensure we are using a valid absolute path
            return net.fetch(pathToFileURL(decodedPath).toString());
        } catch (e) {
            console.error('Protocol error:', e);
            return new Response(null, { status: 404 });
        }
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
