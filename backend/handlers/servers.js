const path = require('path');
const fs = require('fs-extra');
const { app } = require('electron');

module.exports = (ipcMain, win) => {
    const serversDir = path.join(app.getPath('userData'), 'servers');
    fs.ensureDirSync(serversDir);

    ipcMain.handle('server:get-all', async () => {
        try {
            const files = await fs.readdir(serversDir);
            const servers = [];
            for (const file of files) {
                const configPath = path.join(serversDir, file, 'server.json');
                if (await fs.pathExists(configPath)) {
                    const config = await fs.readJson(configPath);
                    servers.push(config);
                }
            }
            return servers;
        } catch (e) {
            console.error('Failed to get servers:', e);
            return [];
        }
    });

    ipcMain.handle('server:create', async (_, { name, version, software, port }) => {
        try {
            const dir = path.join(serversDir, name);
            if (await fs.pathExists(dir)) {
                return { success: false, error: 'Server with this name already exists' };
            }

            await fs.ensureDir(dir);
            const config = {
                name,
                version,
                software,
                port: port || 25565,
                status: 'stopped',
                created: Date.now()
            };

            await fs.writeJson(path.join(dir, 'server.json'), config, { spaces: 4 });
            return { success: true, server: config };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('server:delete', async (_, name) => {
        try {
            const dir = path.join(serversDir, name);
            if (await fs.pathExists(dir)) {
                await fs.remove(dir);
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('server:start', async (_, name) => {
        console.log(`Starting server: ${name}`);
        // Stub implementation
        if (win && win.webContents) {
            win.webContents.send('server:status', { serverName: name, status: 'running' });
            win.webContents.send('server:console', { serverName: name, line: '[Info] Starting server...' });
            win.webContents.send('server:console', { serverName: name, line: '[Info] Server started successfully!' });
        }
        return { success: true };
    });

    ipcMain.handle('server:stop', async (_, name) => {
        console.log(`Stopping server: ${name}`);
        // Stub implementation
        if (win && win.webContents) {
            win.webContents.send('server:status', { serverName: name, status: 'stopped' });
            win.webContents.send('server:console', { serverName: name, line: '[Info] Stopping server...' });
        }
        return { success: true };
    });

    ipcMain.handle('server:restart', async (_, name) => {
        console.log(`Restarting server: ${name}`);
        // Stub implementation
        return { success: true };
    });

    ipcMain.handle('server:get-console', async (_, name) => {
        // Stub implementation
        return [`[Info] Console history for ${name}`, '[Info] No recent activity'];
    });

    ipcMain.handle('server:send-command', async (_, name, command) => {
        console.log(`Sending command to ${name}: ${command}`);
        if (win && win.webContents) {
            win.webContents.send('server:console', { serverName: name, line: `> ${command}` });
            win.webContents.send('server:console', { serverName: name, line: `Executed command: ${command}` });
        }
        return { success: true };
    });
};
