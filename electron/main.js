const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
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

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
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
    require('../backend/handlers/instances')(ipcMain, mainWindow);
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
        console.error('[Main] Failed to register modpack code handler:', e);
    }

    console.log('[Main] Registering extensions handler...');
    try {
        require('../backend/handlers/extensions')(ipcMain, mainWindow);
        console.log('[Main] Extensions handler registered successfully.');   
    } catch (e) {
        console.error('[Main] Failed to register extensions handler:', e);
    }

    require('../backend/handlers/java')(ipcMain);
    const discord = require('../backend/handlers/discord');
    discord.initRPC();
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

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});