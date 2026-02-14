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
        copySettingsEnabled: false,
        copySettingsSourceInstance: '',
        theme: {
            primaryColor: '#1bd96a',
            backgroundColor: '#111111',
            surfaceColor: '#1c1c1cff',
            glassBlur: 10,
            glassOpacity: 0.8,
            borderRadius: 12,
            bgMedia: { url: '', type: 'none' }
        }
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
            // merge with existing to avoid data loss if partial update? 
            // For now UI sends full object.
            await fs.writeJson(settingsPath, newSettings, { spaces: 4 });

            // Notify all windows that theme has changed
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('theme:updated', newSettings.theme);
            });

            // Notify backend handlers of settings change
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

            // Return a normalized path that works with app-media:// protocol
            // We need forward slashes for the URL
            const normalizedPath = destPath.replace(/\\/g, '/');

            return {
                success: true,
                url: normalizedPath, // This will be appended to app-media:///
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

            // Security check: ensure file is inside backgrounds directory
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
};
