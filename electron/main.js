const { app, BrowserWindow, ipcMain, protocol, net, Menu } = require('electron');
console.log('☢️ NUCLEAR STARTUP CHECK: main.js is running!');

ipcMain.handle('ping', () => {
    console.log('📥 Ping received!');
    return 'pong';
});

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const dns = require('dns');
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}
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

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        title: 'MCLC',
        frame: false,
        icon: path.join(__dirname, '../resources/icon.png'),
        backgroundColor: '#121212',
        show: false, // Start hidden for splash transition
        webPreferences: {
            preload: path.join(__dirname, '../backend/preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            v8CacheOptions: 'bypassHeatCheck'
        },
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    console.log('[Main] Preload script configured.');
    console.log('[Main] Registering handlers...');
    console.log('[Main] Registering auth handler...');
    require('../backend/handlers/auth')(ipcMain, mainWindow);
    console.log('[Main] Registering instances handler...');
    try {
        require('../backend/handlers/instances')(ipcMain, mainWindow);
        console.log('[Main] ✅ Instances handler registered successfully.');
    } catch (e) {
        console.error('[Main] ❌ CRITICAL: Failed to register instances handler:');
        console.error('Message:', e.message);
        console.error('Stack:', e.stack);
        if (process.env.NODE_ENV === 'development') {
            process.exit(1); // Fail fast in development
        }
    }
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
    console.log('[Main] Registering modpack code handler...');
    try {
        require('../backend/handlers/modpackCode')(ipcMain, mainWindow);
        console.log('[Main] Modpack code handler registered successfully.');
    } catch (e) {
        console.error('[Main] Failed to register modpack code handler:', e);
    }

    console.log('[Main] Registering extensions handler...');
    try {
        require('../backend/handlers/extensions')(ipcMain, mainWindow);
        console.log('[Main] Extensions handler registered successfully.');
    } catch (e) {
        console.error('[Main] Failed to register extensions handler:', e);
    }

    console.log('[Main] Registering cloud backup handler...');
    try {
        require('../backend/handlers/cloudBackup')(ipcMain, mainWindow);
        console.log('[Main] Cloud backup handler registered successfully.');
    } catch (e) {
        console.error('[Main] Failed to register cloud backup handler:', e);
    }

    require('../backend/handlers/java')(ipcMain);
    const discord = require('../backend/handlers/discord');
    discord.initRPC();

    // Initialize Backup Manager
    const backupManager = require('../backend/backupManager');
    backupManager.init(ipcMain);
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    ipcMain.on('window-minimize', () => mainWindow.minimize());
    ipcMain.on('window-maximize', () => {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    });
    ipcMain.on('window-close', () => mainWindow.close());
    mainWindow.on('maximize', () => mainWindow.webContents.send('window-state', true));
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-state', false));
}

app.whenReady().then(() => {
    protocol.handle('app-media', (request) => {
        try {
            const url = new URL(request.url);

            let decodedPath = decodeURIComponent(url.pathname);
            if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(decodedPath)) {
                decodedPath = decodedPath.slice(1);
            }
            if (!decodedPath || decodedPath === '/' || !require('fs').existsSync(decodedPath)) {
                return new Response('Not Found', { status: 404 });
            }
            return net.fetch(pathToFileURL(decodedPath).toString());
        } catch (e) {
            console.error('Protocol error:', e);
            return new Response(null, { status: 404 });
        }
    });

    const template = [
        ...(process.platform === 'darwin' ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            role: 'window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                { role: 'front' },
                { type: 'separator' },
                { role: 'window' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Unified Deep Link / File Handler
    const handleDeepLink = (argv) => {
        const file = argv.find(arg => arg.endsWith('.mcextension'));
        if (file) {
            console.log('[Main] file opened:', file);
            // Wait for window to be ready if it's not
            if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isLoading()) {
                mainWindow.webContents.send('extension:open-file', file);
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
            } else if (mainWindow) {
                mainWindow.once('ready-to-show', () => {
                    mainWindow.webContents.send('extension:open-file', file);
                });
            }
        }
    };

    // Windows / Linux: Second Instance Lock
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.quit();
    } else {
        app.on('second-instance', (event, commandLine, workingDirectory) => {
            // Someone tried to run a second instance, we should focus our window.
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
                handleDeepLink(commandLine);
            }
        });
    }

    createWindow();

    // Handle init
    handleDeepLink(process.argv);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// macOS: open-file
app.on('open-file', (event, path) => {
    event.preventDefault();
    // We need to store this or send it to the window
    // For simplicity, we just log it for now as the user is likely on Windows
    console.log('[Main] macOS open-file:', path);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});