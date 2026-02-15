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
    console.log('[Main] ========== REGISTRIERE ALLE HANDLER ==========');

    try {
        // Auth Handler
        console.log('[Main] Registering auth handler...');
        require('./handlers/auth')(ipcMain, mainWindow);

        // Instances Handler
        console.log('[Main] Registering instances handler...');
        require('./handlers/instances')(ipcMain, mainWindow);

        // Launcher Handler
        console.log('[Main] Registering launcher handler...');
        const launcherApi = require('./handlers/launcher')(ipcMain, mainWindow);

        // CLI Argument Handling
        const handleCliArgs = (argv) => {
            console.log('[Main] Processing CLI args:', argv);

            // Expected format: mclc.exe run "Instance Name"
            // In dev: electron . run "Instance Name"

            const runIndex = argv.indexOf('run');
            if (runIndex !== -1 && argv.length > runIndex + 1) {
                const instanceName = argv[runIndex + 1];
                console.log(`[Main] CLI Launch request detected for: ${instanceName}`);

                // Allow some time for window to load before launching
                setTimeout(() => {
                    console.log(`[Main] Triggering CLI launch for ${instanceName}`);
                    launcherApi.launchInstance(instanceName).catch(err => {
                        console.error('[Main] CLI launch failed:', err);
                    });
                }, 3000); // 3 seconds delay to ensure UI is ready to receive events
            }
        };

        // Handle args from current process
        handleCliArgs(process.argv);

        // Handle args if second instance tries to launch (Single Instance Lock)
        const gotTheLock = app.requestSingleInstanceLock();
        if (!gotTheLock) {
            app.quit();
        } else {
            app.on('second-instance', (event, commandLine, workingDirectory) => {
                // Someone tried to run a second instance, we should focus our window.
                if (mainWindow) {
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    mainWindow.focus();
                }
                // Handle the CLI args from the second instance
                handleCliArgs(commandLine);
            });
        }


        // Modrinth Handler
        console.log('[Main] Registering modrinth handler...');
        require('./handlers/modrinth')(ipcMain, mainWindow);

        // Data Handler
        console.log('[Main] Registering data handler...');
        require('./handlers/data')(ipcMain, mainWindow);

        // Settings Handler
        console.log('[Main] Registering settings handler...');
        require('./handlers/settings')(ipcMain, mainWindow);

        // Server Handler
        console.log('[Main] Registering server handler...');
        require('./handlers/servers')(ipcMain, mainWindow);

        // ===== NEU: Modpack Code Handler =====
        console.log('[Main] Registering modpack code handler...');
        try {
            const modpackHandler = require('./handlers/modpackCode');
            modpackHandler(ipcMain, mainWindow);
            console.log('[Main] Modpack code handler registered successfully.');
        } catch (error) {
            console.error('[Main] Error registering modpack code handler:', error);
        }
        // ======================================

        // Skins Handler
        console.log('[Main] Registering skins handler...');
        require('./handlers/skins')(ipcMain, mainWindow);

        // Discord RPC Handler
        console.log('[Main] Registering discord handler...');
        try {
            const discord = require('./handlers/discord');
            discord.initRPC();
        } catch (error) {
            console.error('[Main] Discord RPC error:', error);
        }

        console.log('[Main] All handlers registered successfully.');
    } catch (error) {
        console.error('[Main] Error registering handlers:', error);
    }

    // Prüfe ALLE registrierten Handler
    const allHandlers = ipcMain._events ? Object.keys(ipcMain._events) : [];
    console.log('[Main] ALLE registrierten IPC Handler:', allHandlers);

    // Speziell nach modpack Handlern suchen
    const modpackHandlers = allHandlers.filter(key => key.includes('modpack'));
    console.log('[Main] Modpack Handler gefunden:', modpackHandlers);

    // Window controls
    ipcMain.on('window-minimize', () => mainWindow.minimize());
    ipcMain.on('window-maximize', () => {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    });
    ipcMain.on('window-close', () => mainWindow.close());

    // Open external links
    ipcMain.handle('open-external', async (event, url) => {
        try {
            const { shell } = require('electron');
            await shell.openExternal(url);
            return { success: true };
        } catch (error) {
            console.error('Error opening external URL:', error);
            return { success: false, error: error.message };
        }
    });

    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
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