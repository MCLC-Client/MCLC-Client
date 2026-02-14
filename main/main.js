const electronModule = require('electron');
console.log('Electron module type:', typeof electronModule);
console.log('Electron module keys:', Object.keys(electronModule));
console.log('app:', electronModule.app);
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 900,
        minHeight: 600,
        title: 'Minecraft Launcher',
        frame: false, // Custom titlebar support
        backgroundColor: '#121212',
        webPreferences: {
            preload: path.join(__dirname, '../backend/preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false // Required for some heavy node modules if needed, but try keep true if possible
        },
    });

    // Load the backend handlers
    require('../backend/handlers/auth')(ipcMain, mainWindow);
    require('../backend/handlers/instances')(ipcMain, mainWindow);
    require('../backend/handlers/launcher')(ipcMain, mainWindow);
    require('../backend/handlers/modrinth')(ipcMain);
    require('../backend/handlers/data')(ipcMain);
    require('../backend/handlers/settings')(ipcMain);
    const discord = require('../backend/handlers/discord');

    // Initialize Discord RPC
    discord.initRPC();

    // In production, load the built index.html. In dev, load localhost.
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
