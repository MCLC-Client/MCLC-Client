const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs-extra');

module.exports = (ipcMain) => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');

    const defaultSettings = {
        javaPath: '',
        minMemory: 1024,
        maxMemory: 4096,
        resolutionWidth: 854,
        resolutionHeight: 480,
        enableDiscordRPC: true,
        showDisabledFeatures: false,
        copySettingsEnabled: false,
        copySettingsSourceInstance: '',
        optimization: true,
        theme: {
            primaryColor: '#22e07a',
            backgroundColor: '#0d1117',
            surfaceColor: '#161b22',
            glassBlur: 10,
            glassOpacity: 0.8,
            borderRadius: 12,
            bgMedia: { url: '', type: 'none' }
        },
        backupSettings: {
            enabled: true,
            onLaunch: true,
            onClose: true,
            interval: 60,
            maxBackups: 10
        },
        language: 'en'
    };

    ipcMain.handle('settings:get', async () => {
        try {
            if (await fs.pathExists(settingsPath)) {
                const settings = await fs.readJson(settingsPath);
                return { success: true, settings: { ...defaultSettings, ...settings } };
            }
            return { success: true, settings: defaultSettings };
        } catch (error) {
            console.error('Failed to get settings:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('settings:save', async (_, newSettings) => {
        try {
            await fs.writeJson(settingsPath, newSettings, { spaces: 4 });
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('theme:updated', newSettings.theme);
                win.webContents.send('settings:updated', newSettings);
            });
            app.emit('settings-updated', newSettings);

            return { success: true };
        } catch (error) {
            console.error('Failed to save settings:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('settings:select-background', async () => {
        const { dialog } = require('electron');
        const res = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
                { name: 'Media', extensions: ['png', 'jpg', 'jpeg', 'gif', 'mp4', 'webm'] }
            ]
        });

        if (res.canceled || res.filePaths.length === 0) return { success: false };

        const srcPath = res.filePaths[0];
        const ext = path.extname(srcPath).toLowerCase();
        const type = ['.mp4', '.webm'].includes(ext) ? 'video' : 'image';

        try {
            const backgroundsDir = path.join(app.getPath('userData'), 'backgrounds');
            await fs.ensureDir(backgroundsDir);

            const destName = `bg_${Date.now()}${ext}`;
            const destPath = path.join(backgroundsDir, destName);

            await fs.copy(srcPath, destPath);
            const normalizedPath = destPath.replace(/\\/g, '/');

            return {
                success: true,
                url: normalizedPath,
                type: type
            };
        } catch (error) {
            console.error('Failed to copy background:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('settings:delete-background', async (_, filePath) => {
        try {
            if (!filePath) return { success: false, error: 'No file path provided' };

            const backgroundsDir = path.join(app.getPath('userData'), 'backgrounds');
            const normalize = (p) => path.normalize(p).toLowerCase();
            if (!normalize(filePath).startsWith(normalize(backgroundsDir))) {
                console.error('Attempted to delete file outside backgrounds directory:', filePath);
                return { success: false, error: 'Invalid file path' };
            }

            if (await fs.pathExists(filePath)) {
                await fs.remove(filePath);
                return { success: true };
            }
            return { success: false, error: 'File not found' };

        } catch (error) {
            console.error('Failed to delete background:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('dialog:save-file', async (_, options) => {
        const { dialog } = require('electron');
        const res = await dialog.showSaveDialog(options);
        if (res.canceled) return null;
        return res.filePath;
    });
};