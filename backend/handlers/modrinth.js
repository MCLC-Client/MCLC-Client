const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');

const MODRINTH_API = 'https://api.modrinth.com/v2';
const appData = app.getPath('userData');
const instancesDir = path.join(appData, 'instances');

module.exports = (ipcMain, win) => {
    ipcMain.handle('modrinth:search', async (_, query, facets = [], options = {}) => {
        try {
            // Default to filtering for mods if not needed
            // Default options
            const { limit = 20, offset = 0, index, projectType = 'mod' } = options;

            const facetStr = JSON.stringify([[`project_type:${projectType}`], ...facets]);
            const params = {
                query,
                facets: facetStr,
                limit,
                offset
            };
            if (index) params.index = index;

            const response = await axios.get(`${MODRINTH_API}/search`, {
                params,
                headers: {
                    'User-Agent': 'Antigravity/MinecraftLauncher/1.0 (fernsehheft@pluginhub.de)'
                }
            });
            return {
                success: true,
                results: response.data.hits,
                total_hits: response.data.total_hits,
                offset: response.data.offset,
                limit: response.data.limit
            };
        } catch (e) {
            console.error("Modrinth Search Error:", e.response ? e.response.data : e.message);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('modrinth:install', async (_, { instanceName, projectId, versionId, filename, url, projectType }) => {
        try {
            let folder = 'mods';
            if (projectType === 'resourcepack') folder = 'resourcepacks';
            if (projectType === 'shader') folder = 'shaderpacks';

            const contentDir = path.join(instancesDir, instanceName, folder);
            await fs.ensureDir(contentDir);

            const dest = path.join(contentDir, filename);

            const writer = fs.createWriteStream(dest);
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
                timeout: 30000
            });

            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;

            response.data.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (win) {
                    const progress = Math.round((downloadedSize / totalSize) * 100);
                    win.webContents.send('install:progress', {
                        instanceName,
                        progress,
                        status: `Installing ${filename}`
                    });
                }
            });

            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            if (win) {
                win.webContents.send('install:progress', {
                    instanceName,
                    progress: 100,
                    status: `Installed ${filename}`
                });
            }

            // --- Auto-Shader Software Installation ---
            if (projectType === 'shader') {
                try {
                    const instanceJsonPath = path.join(instancesDir, instanceName, 'instance.json');
                    if (await fs.pathExists(instanceJsonPath)) {
                        const instance = await fs.readJson(instanceJsonPath);
                        const loader = instance.loader ? instance.loader.toLowerCase() : 'vanilla';
                        const version = instance.version;

                        const softwares = [];

                        if (loader === 'fabric' || loader === 'quilt' || loader === 'neoforge') {
                            softwares.push({ id: 'iris', name: 'Iris Shaders' });
                            softwares.push({ id: 'sodium', name: 'Sodium' });
                        } else if (loader === 'forge') {
                            softwares.push({ id: 'oculus', name: 'Oculus' });
                        }

                        for (const sw of softwares) {
                            try {
                                // Check if already installed
                                const modsDir = path.join(instancesDir, instanceName, 'mods');
                                await fs.ensureDir(modsDir);
                                const currentFiles = await fs.readdir(modsDir);

                                const res = await axios.get(`${MODRINTH_API}/project/${sw.id}/version`, {
                                    params: {
                                        loaders: JSON.stringify([loader]),
                                        game_versions: JSON.stringify([version])
                                    },
                                    headers: {
                                        'User-Agent': 'Antigravity/MinecraftLauncher/1.0 (fernsehheft@pluginhub.de)'
                                    }
                                });

                                if (res.data && res.data.length > 0) {
                                    const latest = res.data[0];
                                    const file = latest.files.find(f => f.primary) || latest.files[0];

                                    if (!currentFiles.includes(file.filename)) {
                                        console.log(`[Modrinth] Auto-installing ${sw.name} for shader dependency.`);
                                        const softwareDest = path.join(modsDir, file.filename);
                                        const swWriter = fs.createWriteStream(softwareDest);
                                        const swRes = await axios({ url: file.url, method: 'GET', responseType: 'stream' });
                                        swRes.data.pipe(swWriter);
                                        await new Promise((resolve) => swWriter.on('finish', resolve));

                                        if (win) {
                                            win.webContents.send('install:progress', {
                                                instanceName,
                                                progress: 100,
                                                status: `Auto-installed ${sw.name} for shader support`
                                            });
                                        }
                                    }
                                }
                            } catch (swErr) {
                                console.error(`[Modrinth] Error auto-installing ${sw.name}:`, swErr.message);
                            }
                        }
                    }
                } catch (err) {
                    console.error("[Modrinth] Error auto-installing shader software:", err);
                }
            }

            return { success: true };

        } catch (e) {
            console.error("Modrinth Install Error:", e);
            return { success: false, error: e.message };
        }
    });

    // Helper to get versions for a project
    ipcMain.handle('modrinth:get-versions', async (_, projectId, loaders = [], gameVersions = []) => {
        try {
            // modrinth api requires specific formatting for loaders and game_versions
            const params = {};
            if (loaders.length) params.loaders = JSON.stringify(loaders);
            if (gameVersions.length) params.game_versions = JSON.stringify(gameVersions);

            const response = await axios.get(`${MODRINTH_API}/project/${projectId}/version`, { params });
            return { success: true, versions: response.data };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('modrinth:update-file', async (_, { instanceName, projectType, oldFileName, newFileName, url }) => {
        try {
            const folder = projectType === 'resourcepack' ? 'resourcepacks' : 'mods';
            const contentDir = path.join(instancesDir, instanceName, folder);

            const oldPath = path.join(contentDir, oldFileName);
            const newPath = path.join(contentDir, newFileName);

            console.log(`[Modrinth:Update] Updating ${oldFileName} -> ${newFileName} in ${instanceName}`);

            // Download new file
            const writer = fs.createWriteStream(newPath);
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
                timeout: 30000
            });

            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;

            response.data.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (win) {
                    const progress = Math.round((downloadedSize / totalSize) * 100);
                    win.webContents.send('install:progress', {
                        instanceName,
                        progress,
                        status: `Updating ${newFileName}`
                    });
                }
            });

            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // Delete old file
            if (await fs.pathExists(oldPath)) {
                await fs.remove(oldPath);
            }

            if (win) {
                win.webContents.send('install:progress', {
                    instanceName,
                    progress: 100,
                    status: `Updated ${newFileName}`
                });
            }

            return { success: true };
        } catch (e) {
            console.error(`[Modrinth:Update] Error updating file:`, e);
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('modrinth:get-project', async (_, projectId) => {
        try {
            const response = await axios.get(`${MODRINTH_API}/project/${projectId}`);
            return { success: true, project: response.data };
        } catch (e) {
            console.error("Modrinth Get Project Error:", e.response ? e.response.data : e.message);
            return { success: false, error: e.message };
        }
    });
};
