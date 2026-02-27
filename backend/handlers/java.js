const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');
const { installJava } = require('../utils/java-utils');

module.exports = (ipcMain) => {
    const appData = app.getPath('userData');
    const runtimesDir = path.join(appData, 'runtimes');

    ipcMain.handle('java:install', async (event, version) => {
        try {
            console.log(`[JavaHandler] Request to install Java ${version}`);
            const sender = event.sender;

            const result = await installJava(version, runtimesDir, (step, progress) => {
                sender.send('java:progress', { step, progress });
            });

            return result;
        } catch (e) {
            console.error('[JavaHandler] Error:', e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('java:list', async () => {
        try {
            await fs.ensureDir(runtimesDir);
            const dirs = await fs.readdir(runtimesDir);
            const runtimes = [];

            // 1. Scan internal runtimes
            for (const dir of dirs) {
                const fullPath = path.join(runtimesDir, dir);
                const stats = await fs.stat(fullPath).catch(() => null);
                if (stats && stats.isDirectory()) {
                    let javaBin = process.platform === 'win32'
                        ? path.join(fullPath, 'bin', 'java.exe')
                        : path.join(fullPath, 'bin', 'java');
                    if (await fs.pathExists(javaBin)) {
                        runtimes.push({
                            name: dir,
                            path: javaBin,
                            dirPath: fullPath,
                            type: 'internal'
                        });
                    }
                }
            }

            // 2. Scan system Java (Windows focusing)
            if (process.platform === 'win32') {
                const systemJavas = await scanSystemJava();
                for (const sj of systemJavas) {
                    // Avoid duplicates if they happen to point to the same binary
                    if (!runtimes.some(r => r.path.toLowerCase() === sj.path.toLowerCase())) {
                        runtimes.push({
                            name: sj.name,
                            path: sj.path,
                            dirPath: sj.dirPath,
                            type: 'system'
                        });
                    }
                }
            } else {
                // Linux/Mac: check 'java' in PATH
                try {
                    const { execSync } = require('child_process');
                    const javaPath = execSync('which java').toString().trim();
                    if (javaPath && await fs.pathExists(javaPath)) {
                        runtimes.push({
                            name: 'System Java',
                            path: javaPath,
                            dirPath: path.dirname(path.dirname(javaPath)),
                            type: 'system'
                        });
                    }
                } catch (e) { /* ignore */ }
            }

            return { success: true, runtimes };
        } catch (e) {
            console.error('[JavaHandler] java:list error:', e);
            return { success: false, error: e.message };
        }
    });

    async function scanSystemJava() {
        const found = [];
        const { execSync } = require('child_process');

        // Check PATH
        try {
            const whereJava = execSync('where java', { encoding: 'utf8' }).split(/\r?\n/);
            for (let p of whereJava) {
                p = p.trim();
                if (p && await fs.pathExists(p)) {
                    found.push({
                        name: `System (PATH: ${path.basename(path.dirname(path.dirname(p)))})`,
                        path: p,
                        dirPath: path.dirname(path.dirname(p))
                    });
                }
            }
        } catch (e) { /* ignore */ }

        // Common install dirs
        const commonDirs = [
            'C:\\Program Files\\Java',
            'C:\\Program Files (x86)\\Java',
            'C:\\Program Files\\Eclipse Adoptium',
            'C:\\Program Files\\Microsoft\\Jdk',
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Eclipse Adoptium')
        ];

        for (const baseDir of commonDirs) {
            if (await fs.pathExists(baseDir)) {
                try {
                    const subdirs = await fs.readdir(baseDir);
                    for (const sub of subdirs) {
                        const full = path.join(baseDir, sub);
                        const bin = path.join(full, 'bin', 'java.exe');
                        if (await fs.pathExists(bin)) {
                            found.push({
                                name: sub,
                                path: bin,
                                dirPath: full
                            });
                        }
                    }
                } catch (e) { /* ignore */ }
            }
        }

        return found;
    }

    ipcMain.handle('java:delete', async (event, dirPath) => {
        try {

            if (!dirPath.startsWith(runtimesDir)) {
                return { success: false, error: "Only internal runtimes can be deleted." };
            }
            await fs.remove(dirPath);
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('java:open-folder', async () => {
        try {
            await fs.ensureDir(runtimesDir);
            const { shell } = require('electron');
            await shell.openPath(runtimesDir);
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });
};