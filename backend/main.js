const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');

console.log('Electron versions:', process.versions);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 900,
        minHeight: 600,
        title: 'Minecraft Launcher',
        frame: false,
        backgroundColor: '#121212',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        },
    });

    console.log('[Main] Preload script configured.');
    console.log('[Main] Registering handlers...');

    // Load all handlers
    try {
        console.log('[Main] Registering auth handler...');
        require('./handlers/auth')(ipcMain, mainWindow);

        console.log('[Main] Registering instances handler...');
        require('./handlers/instances')(ipcMain, mainWindow);

        console.log('[Main] Registering launcher handler...');
        require('./handlers/launcher')(ipcMain, mainWindow);

        console.log('[Main] Registering modrinth handler...');
        require('./handlers/modrinth')(ipcMain, mainWindow);

        console.log('[Main] Registering data handler...');
        require('./handlers/data')(ipcMain, mainWindow);

        console.log('[Main] Registering settings handler...');
        require('./handlers/settings')(ipcMain, mainWindow);

        console.log('[Main] Registering server handler...');
        require('./handlers/servers')(ipcMain, mainWindow);

        console.log('[Main] All handlers registered successfully.');
    } catch (error) {
        console.error('[Main] Error registering handlers:', error);
    }

    // Initialize Discord RPC
    try {
        const discord = require('./handlers/discord');
        discord.initRPC();
    } catch (error) {
        console.error('[Main] Discord RPC error:', error);
    }

    const isDev = process.env.NODE_ENV === 'development';
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
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});