const { app, BrowserWindow, ipcMain, protocol, net, Menu } = require('electron');

// Force WebGL/GPU acceleration on Linux/unsupported systems
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-gpu-driver-bug-workarounds');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

if (process.platform === 'linux') {
    // Sometimes necessary for WebGL on certain Linux drivers/sandboxes
    app.commandLine.appendSwitch('disable-gpu-sandbox');
    // Try 'desktop' or 'egl'. Letting it auto-detect might be safer if desktop fails.
    // app.commandLine.appendSwitch('use-gl', 'desktop'); 
}
app.commandLine.appendSwitch('enable-webgl-draft-extensions');

const path = require('path');
console.log('NUCLEAR STARTUP CHECK: main.js is running!');
console.log('[DEBUG] CWD:', process.cwd());
console.log('[DEBUG] __dirname:', __dirname);
console.log('[DEBUG] Preload Path:', path.join(__dirname, '../backend/preload.js'));

ipcMain.handle('ping', () => {
    console.log('Ping received!');
    return 'pong';
});

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
        show: false,
        webPreferences: {
            preload: path.join(__dirname, '../backend/preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
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
            process.exit(1);
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
    const backupManager = require('../backend/backupManager');
    backupManager.init(ipcMain);
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    if (isDev) {
        console.log('[Main] Loading development URL...');
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        const indexPath = path.join(__dirname, '../dist/index.html');
        console.log(`[Main] Loading production file: ${indexPath}`);

        if (!fs.existsSync(indexPath)) {
            console.error(`[Main] CRITICAL ERROR: Production index.html not found at ${indexPath}`);
        }

        mainWindow.loadFile(indexPath).catch(err => {
            console.error('[Main] Failed to load production file:', err);
        });
    }
    ipcMain.on('window-minimize', () => mainWindow.minimize());
    ipcMain.on('window-maximize', () => {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    });
    ipcMain.on('window-close', () => mainWindow.close());
    ipcMain.on('update:quit-and-install', () => {
        const { autoUpdater } = require('electron-updater');
        autoUpdater.quitAndInstall();
    });
    mainWindow.on('maximize', () => mainWindow.webContents.send('window-state', true));
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-state', false));
}

function setupAppMediaProtocol() {
    protocol.handle('app-media', (request) => {
        try {
            const url = new URL(request.url);
            // Combine host and pathname to handle drive letters (e.g., host="C:", pathname="/Users/...")
            let decodedPath = decodeURIComponent(url.host + url.pathname);

            console.log(`[Main] app-media request: ${request.url} -> decodedPath: ${decodedPath}`);

            const resolvedPath = path.resolve(decodedPath);

            // Security: Ensure the path is within the app's data directory (V6)
            const userDataPath = app.getPath('userData');
            const isInside = process.platform === 'win32'
                ? resolvedPath.toLowerCase().startsWith(userDataPath.toLowerCase())
                : resolvedPath.startsWith(userDataPath);

            if (!isInside) {
                console.error(`[Main] Blocked app-media attempt to access path outside userData: ${resolvedPath}`);
                return new Response('Access Denied', { status: 403 });
            }

            return net.fetch(pathToFileURL(resolvedPath).toString());
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
}

const handleDeepLink = (argv) => {
    const file = argv.find(arg => arg.endsWith('.mcextension'));
    if (file) {
        console.log('[Main] file opened:', file);

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

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            handleDeepLink(commandLine);
        }
    });
}

app.whenReady().then(() => {
    setupAppMediaProtocol();
    createWindow();
    handleDeepLink(process.argv);

    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
        console.log('[AutoUpdater] Checking for update...');
    });
    autoUpdater.on('update-available', (info) => {
        console.log('[AutoUpdater] Update available:', info.version);
        if (mainWindow) mainWindow.webContents.send('update:available', info);
    });
    autoUpdater.on('update-not-available', (info) => {
        console.log('[AutoUpdater] Update not available.');
        if (mainWindow) mainWindow.webContents.send('update:not-available', info);
    });
    autoUpdater.on('download-progress', (progressObj) => {
        console.log(`[AutoUpdater] Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`);
        if (mainWindow) mainWindow.webContents.send('update:progress', progressObj);
    });
    autoUpdater.on('update-downloaded', (info) => {
        console.log('[AutoUpdater] Update downloaded:', info.version);
        if (mainWindow) mainWindow.webContents.send('update:downloaded', info);
    });
    autoUpdater.on('error', (err) => {
        const msg = (err && (err.message || err.toString())) || '';
        console.error('[AutoUpdater] Error Object:', err);
        console.error('[AutoUpdater] Error Message String:', msg);

        const lowerMsg = msg.toLowerCase();
        if (lowerMsg.includes('latest.yml') || lowerMsg.includes('dev-app-update.yml') || lowerMsg.includes('could not find latest.yml')) {
            console.log('[AutoUpdater] 🛑 Suppressing known non-critical update error:', msg);
            return;
        }
        if (mainWindow) {
            console.log('[AutoUpdater] 📤 Sending error to renderer:', msg);
            mainWindow.webContents.send('update:error', msg);
        }
    });

    if (app.isPackaged) {
        autoUpdater.checkForUpdates().catch(err => {
            console.error('[AutoUpdater] Check failed:', err);
        });
    } else {
        // For development testing: notify update not available after delay
        setTimeout(() => {
            if (mainWindow) {
                // mainWindow.webContents.send('update:available', { version: '9.9.9' }); // For Testign
            }
        }, 5000);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('open-file', (event, path) => {
    event.preventDefault();
    console.log('[Main] macOS open-file:', path);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});