const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');
const { installModInternal } = require('./modrinth');

// WICHTIG: http:// hinzufügen!
const SERVER_URL = 'https://mclc.pluginhub.de';

console.log('[ModpackCode-Handler] 🔧 Modul wird geladen...');

/**
 * Calculates SHA1 hash of a file
 * @param {string} filePath 
 * @returns {Promise<string>}
 */
function calculateSha1(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha1');
        const stream = fs.createReadStream(filePath);
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', err => reject(err));
    });
}

module.exports = (ipcMain, win) => {
    console.log('[ModpackCode-Handler] 🔌 Registriere Handler...');

    const appData = app.getPath('userData');
    const instancesDir = path.join(appData, 'instances');

    // Export modpack as code
    ipcMain.handle('modpack:export-code', async (event, data) => {
        console.log('[ModpackCode-Handler] 📤 Export handler AUFGERUFEN', data);
        try {
            const { name, mods, resourcePacks, shaders, instanceVersion, instanceLoader, instanceName } = data;

            // Read keybinds (options.txt) if instanceName is provided
            let optionsContent = null;
            if (instanceName) {
                const optionsPath = path.join(instancesDir, instanceName, 'options.txt');
                if (await fs.pathExists(optionsPath)) {
                    optionsContent = await fs.readFile(optionsPath, 'utf8');
                    console.log('[ModpackCode-Handler] ✅ Keybinds (options.txt) included in export');
                }
            }

            // Prepare data for server
            const exportData = {
                name: name || 'My Modpack',
                mods: mods?.map(m => ({
                    projectId: m.projectId,
                    versionId: m.versionId,
                    fileName: m.name || m.fileName,
                    title: m.title || m.name,
                    icon: m.icon
                })) || [],
                resourcePacks: resourcePacks?.map(p => ({
                    projectId: p.projectId,
                    versionId: p.versionId,
                    fileName: p.name || p.fileName,
                    title: p.title || p.name,
                    icon: p.icon
                })) || [],
                shaders: shaders?.map(s => ({
                    projectId: s.projectId,
                    versionId: s.versionId,
                    fileName: s.name || s.fileName,
                    title: s.title || s.name,
                    icon: s.icon
                })) || [],
                instanceVersion,
                instanceLoader,
                keybinds: optionsContent
            };

            // Send to server
            const response = await axios.post(`${SERVER_URL}/api/modpack/save`, exportData, {
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.data.success) {
                return { success: true, code: response.data.code };
            } else {
                return { success: false, error: 'Server returned an error' };
            }
        } catch (error) {
            console.error('[ModpackCode-Handler] ❌ Export error:', error);
            if (error.code === 'ECONNREFUSED') {
                return { success: false, error: 'Modpack Code Server is not running on port 4000.' };
            }
            return {
                success: false,
                error: error.response?.data?.error || error.message || 'Failed to connect to server'
            };
        }
    });

    // Import modpack from code (metadata fetch)
    ipcMain.handle('modpack:import-code', async (event, code) => {
        try {
            if (!code || code.length !== 8) {
                return { success: false, error: 'Invalid code format. Code must be 8 characters.' };
            }

            const response = await axios.get(`${SERVER_URL}/api/modpack/${code}`, { timeout: 10000 });

            if (!response.data || !response.data.success) {
                return { success: false, error: 'Code not found' };
            }

            return { success: true, data: response.data.data };
        } catch (error) {
            console.error('[ModpackCode-Handler] ❌ Import metadata error:', error);
            if (error.response?.status === 404) return { success: false, error: 'Code not found' };
            return {
                success: false,
                error: error.response?.data?.error || error.message || 'Failed to connect to server'
            };
        }
    });

    // Background installation process for imports
    ipcMain.handle('modpack:install-shared-content', async (event, { instanceName, modpackData }) => {
        console.log(`[ModpackCode-Handler] Starting background install for: ${instanceName}`);

        const totalItems = (modpackData.mods?.length || 0) +
            (modpackData.resourcePacks?.length || 0) +
            (modpackData.shaders?.length || 0);

        // Send immediate start event to ensure UI shows "Installing" state
        win.webContents.send('install:progress', {
            instanceName: instanceName,
            progress: 0,
            status: 'Preparing installation...'
        });

        // Accumulate new cache entries locally
        const localModCache = {};

        // Helper to safely update the global cache file
        const saveModCache = async () => {
            try {
                let currentCache = {};
                if (await fs.pathExists(modCachePath)) {
                    try {
                        currentCache = await fs.readJson(modCachePath);
                    } catch (e) { /* ignore read error */ }
                }
                const merged = { ...currentCache, ...localModCache };
                await fs.writeJson(modCachePath, merged);
                console.log('[ModpackCode-Handler] Cache safely updated.');
            } catch (e) {
                console.error('[ModpackCode-Handler] Failed to save mods cache:', e);
            }
        };

        if (totalItems === 0) {
            if (modpackData.keybinds) {
                const optionsPath = path.join(instancesDir, instanceName, 'options.txt');
                await fs.writeFile(optionsPath, modpackData.keybinds);
            }
            return { success: true };
        }

        let installedCount = 0;

        const reportProgress = (status, individualProgress = null) => {
            // Overall modpack progress
            const overallProgress = Math.round((installedCount / totalItems) * 100);

            win.webContents.send('install:progress', {
                instanceName: instanceName,
                progress: individualProgress !== null ? individualProgress : overallProgress,
                status: status || `Importing modpack: ${installedCount}/${totalItems}`
            });
        };

        try {
            // Restore Keybinds first
            if (modpackData.keybinds) {
                const optionsPath = path.join(instancesDir, instanceName, 'options.txt');
                await fs.writeFile(optionsPath, modpackData.keybinds);
                console.log('[ModpackCode-Handler] Keybinds restored.');
            }

            // Helper to resolve actual download URL from Modrinth API
            const resolveModrinthDownloadUrl = async (versionId, expectedFileName) => {
                try {
                    const versionRes = await axios.get(`https://api.modrinth.com/v2/version/${versionId}`, {
                        headers: { 'User-Agent': 'Client/MCLC/1.0 (fernsehheft@pluginhub.de)' },
                        timeout: 10000
                    });
                    const versionData = versionRes.data;
                    const file = versionData.files.find(f => f.primary) || versionData.files[0];
                    return {
                        url: file.url,
                        filename: file.filename,
                        versionNumber: versionData.version_number
                    };
                } catch (e) {
                    console.error(`[ModpackCode-Handler] Failed to resolve URL for version ${versionId}:`, e.message);
                    return null;
                }
            };

            // Install Mods
            for (const mod of modpackData.mods || []) {
                reportProgress(`Downloading mod: ${mod.title}`);

                // Resolve actual download URL from Modrinth
                const resolved = await resolveModrinthDownloadUrl(mod.versionId, mod.fileName);
                if (!resolved) {
                    console.error(`[ModpackCode-Handler] Skipping mod ${mod.title}: could not resolve download URL`);
                    installedCount++;
                    reportProgress();
                    continue;
                }

                const result = await installModInternal(win, {
                    instanceName,
                    projectId: mod.projectId,
                    versionId: mod.versionId,
                    filename: resolved.filename || mod.fileName,
                    url: resolved.url,
                    projectType: 'mod'
                });

                if (result.success) {
                    try {
                        const actualFileName = resolved.filename || mod.fileName;
                        const filePath = path.join(instancesDir, instanceName, 'mods', actualFileName);
                        if (await fs.pathExists(filePath)) {
                            const fsStats = await fs.stat(filePath);
                            const cacheKey = `${actualFileName}-${fsStats.size}`;
                            localModCache[cacheKey] = {
                                title: mod.title,
                                icon: mod.icon,
                                version: resolved.versionNumber,
                                projectId: mod.projectId,
                                versionId: mod.versionId,
                                timestamp: Date.now()
                            };
                            console.log(`[ModpackCode-Handler] Cached metadata for mod: ${mod.title} (Key: ${cacheKey})`);
                        }
                    } catch (cacheErr) {
                        console.error('Failed to update cache for mod', mod.title, cacheErr);
                    }
                }
                installedCount++;
                reportProgress();
            }

            // Install Resource Packs
            for (const pack of modpackData.resourcePacks || []) {
                reportProgress(`Downloading pack: ${pack.title}`);

                const resolved = await resolveModrinthDownloadUrl(pack.versionId, pack.fileName);
                if (!resolved) {
                    console.error(`[ModpackCode-Handler] Skipping pack ${pack.title}: could not resolve download URL`);
                    installedCount++;
                    reportProgress();
                    continue;
                }

                const result = await installModInternal(win, {
                    instanceName,
                    projectId: pack.projectId,
                    versionId: pack.versionId,
                    filename: resolved.filename || pack.fileName,
                    url: resolved.url,
                    projectType: 'resourcepack'
                });

                if (result.success) {
                    try {
                        const actualFileName = resolved.filename || pack.fileName;
                        const filePath = path.join(instancesDir, instanceName, 'resourcepacks', actualFileName);
                        if (await fs.pathExists(filePath)) {
                            const fsStats = await fs.stat(filePath);
                            const cacheKey = `${actualFileName}-${fsStats.size}`;
                            localModCache[cacheKey] = {
                                title: pack.title,
                                icon: pack.icon,
                                version: resolved.versionNumber,
                                projectId: pack.projectId,
                                versionId: pack.versionId,
                                timestamp: Date.now()
                            };
                            console.log(`[ModpackCode-Handler] Cached metadata for resourcepack: ${pack.title} (Key: ${cacheKey})`);
                        }
                    } catch (cacheErr) {
                        console.error('Failed to update cache for resourcepack', pack.title, cacheErr);
                    }
                }
                installedCount++;
                reportProgress();
            }

            // Install Shaders
            for (const shader of modpackData.shaders || []) {
                reportProgress(`Downloading shader: ${shader.title}`);

                const resolved = await resolveModrinthDownloadUrl(shader.versionId, shader.fileName);
                if (!resolved) {
                    console.error(`[ModpackCode-Handler] Skipping shader ${shader.title}: could not resolve download URL`);
                    installedCount++;
                    reportProgress();
                    continue;
                }

                const result = await installModInternal(win, {
                    instanceName,
                    projectId: shader.projectId,
                    versionId: shader.versionId,
                    filename: resolved.filename || shader.fileName,
                    url: resolved.url,
                    projectType: 'shader'
                });

                if (result.success) {
                    try {
                        const actualFileName = resolved.filename || shader.fileName;
                        const filePath = path.join(instancesDir, instanceName, 'shaderpacks', actualFileName);
                        if (await fs.pathExists(filePath)) {
                            const fsStats = await fs.stat(filePath);
                            const cacheKey = `${actualFileName}-${fsStats.size}`;
                            localModCache[cacheKey] = {
                                title: shader.title,
                                icon: shader.icon,
                                version: resolved.versionNumber,
                                projectId: shader.projectId,
                                versionId: shader.versionId,
                                timestamp: Date.now()
                            };
                            console.log(`[ModpackCode-Handler] Cached metadata for shader: ${shader.title} (Key: ${cacheKey})`);
                        }
                    } catch (cacheErr) {
                        console.error('Failed to update cache for shader', shader.title, cacheErr);
                    }
                }
                installedCount++;
                reportProgress();
            }

            await saveModCache();
            reportProgress('Installation complete!', 100);
            return { success: true };
        } catch (error) {
            console.error('[ModpackCode-Handler] Background install failed:', error);
            return { success: false, error: error.message };
        }
    });

    console.log('[ModpackCode-Handler] ALLE Handler registriert!');
};