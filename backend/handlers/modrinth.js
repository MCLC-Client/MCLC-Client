const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');

const MODRINTH_API = 'https://api.modrinth.com/v2';
const appData = app.getPath('userData');
const instancesDir = path.join(appData, 'instances');

const installModInternal = async (win, { instanceName, projectId, versionId, filename, url, projectType }) => {
    try {
        let folder = 'mods';
        if (projectType === 'resourcepack') folder = 'resourcepacks';
        if (projectType === 'shader') folder = 'shaderpacks';

        const contentDir = path.join(instancesDir, instanceName, folder);
        await fs.ensureDir(contentDir);

        const dest = path.join(contentDir, filename);
        if (await fs.pathExists(dest)) {
            if (win) {
                win.webContents.send('install:progress', {
                    instanceName,
                    progress: 100,
                    status: `Skipping ${filename} (already installed)`
                });
            }
            return { success: true, skipped: true };
        }

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            headers: {
                'User-Agent': 'MCLCAGENT/MinecraftLauncher/1.0 (fernsehheft@pluginhub.de)'
            },
            timeout: 30000
        });

        const writer = fs.createWriteStream(dest);

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
                            const modsDir = path.join(instancesDir, instanceName, 'mods');
                            await fs.ensureDir(modsDir);
                            const currentFiles = await fs.readdir(modsDir);

                            const res = await axios.get(`${MODRINTH_API}/project/${sw.id}/version`, {
                                params: {
                                    loaders: JSON.stringify([loader]),
                                    game_versions: JSON.stringify([version])
                                },
                                headers: {
                                    'User-Agent': 'MCLCAGENT/MinecraftLauncher/1.0 (fernsehheft@pluginhub.de)'
                                }
                            });

                            if (res.data && res.data.length > 0) {
                                const latest = res.data[0];
                                const file = latest.files.find(f => f.primary) || latest.files[0];

                                if (!currentFiles.includes(file.filename)) {
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

        if (dest && await fs.pathExists(dest)) {
            try { await fs.unlink(dest); } catch (delErr) { }
        }
        return { success: false, error: e.message };
    }
};

const resolveDependenciesInternal = async (versionId, loaders = [], gameVersions = []) => {
    const resolved = new Map();
    const queue = [versionId];
    const visited = new Set();

    try {
        while (queue.length > 0) {
            const currentId = queue.shift();
            if (visited.has(currentId)) continue;
            const vRes = await axios.get(`${MODRINTH_API}/version/${currentId}`);
            const version = vRes.data;
            if (!resolved.has(version.project_id)) {

                const pRes = await axios.get(`${MODRINTH_API}/project/${version.project_id}`);
                resolved.set(version.project_id, {
                    projectId: version.project_id,
                    versionId: version.id,
                    title: pRes.data.title,
                    iconUrl: pRes.data.icon_url,
                    filename: (version.files.find(f => f.primary) || version.files[0]).filename,
                    url: (version.files.find(f => f.primary) || version.files[0]).url,
                    projectType: pRes.data.project_type,
                    isPrimary: resolved.size === 0
                });
            }
            if (version.dependencies) {
                for (const dep of version.dependencies) {
                    if (dep.dependency_type !== 'required') continue;
                    if (dep.version_id) {
                        if (!visited.has(dep.version_id)) {
                            queue.push(dep.version_id);
                        }
                    }

                    else if (dep.project_id) {
                        if (!resolved.has(dep.project_id)) {
                            const params = {
                                loaders: JSON.stringify(loaders),
                                game_versions: JSON.stringify(gameVersions)
                            };
                            try {
                                const vListRes = await axios.get(`${MODRINTH_API}/project/${dep.project_id}/version`, { params });
                                if (vListRes.data && vListRes.data.length > 0) {
                                    queue.push(vListRes.data[0].id);
                                }
                            } catch (err) {
                                console.warn(`[Modrinth:Resolve] Could not find compatible version for dependency project ${dep.project_id}`);
                            }
                        }
                    }
                }
            }
            visited.add(currentId);
        }

        return { success: true, dependencies: Array.from(resolved.values()) };
    } catch (e) {
        console.error("[Modrinth:Resolve] Error:", e.response?.data || e.message);
        return { success: false, error: e.message };
    }
};

module.exports = (ipcMain, win) => {
    ipcMain.handle('modrinth:search', async (_, query, facets = [], options = {}) => {
        try {
            const { limit = 20, offset = 0, index, projectType = 'mod' } = options;
            const facetStr = JSON.stringify([[`project_type:${projectType}`], ...facets]);
            const params = { query, facets: facetStr, limit, offset };
            if (index) params.index = index;

            const response = await axios.get(`${MODRINTH_API}/search`, {
                params,
                headers: { 'User-Agent': 'MCLCAGENT/MinecraftLauncher/1.0 (fernsehheft@pluginhub.de)' }
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

    ipcMain.handle('modrinth:install', async (_, data) => {
        if (data.projectType === 'mod') {
            try {
                const instanceJsonPath = path.join(instancesDir, data.instanceName, 'instance.json');
                if (await fs.pathExists(instanceJsonPath)) {
                    const instance = await fs.readJson(instanceJsonPath);
                    const loader = instance.loader ? instance.loader.toLowerCase() : 'vanilla';
                    const version = instance.version;
                    if (loader !== 'vanilla') {
                        const resolveRes = await resolveDependenciesInternal(data.versionId, [loader], [version]);

                        if (resolveRes.success && resolveRes.dependencies.length > 0) {
                            let successCount = 0;
                            let failCount = 0;
                            for (const dep of resolveRes.dependencies) {
                                const installRes = await installModInternal(win, {
                                    instanceName: data.instanceName,
                                    projectId: dep.projectId,
                                    versionId: dep.versionId,
                                    filename: dep.filename,
                                    url: dep.url,
                                    projectType: dep.projectType || 'mod'
                                });

                                if (installRes.success) successCount++;
                                else failCount++;
                            }

                            if (failCount === 0) return { success: true };
                            return { success: true };
                        }
                    }
                }
            } catch (err) {
                console.error("[Modrinth:Install] Dependency resolution failed, falling back to single install:", err);
            }
        }
        return await installModInternal(win, data);
    });

    ipcMain.handle('modrinth:get-versions', async (_, projectId, loaders = [], gameVersions = []) => {
        try {
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

            const writer = fs.createWriteStream(newPath);
            const response = await axios({ url, method: 'GET', responseType: 'stream', timeout: 30000 });

            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;

            response.data.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (win) {
                    const progress = Math.round((downloadedSize / totalSize) * 100);
                    win.webContents.send('install:progress', { instanceName, progress, status: `Updating ${newFileName}` });
                }
            });

            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            if (await fs.pathExists(oldPath)) await fs.remove(oldPath);
            if (win) {
                win.webContents.send('install:progress', { instanceName, progress: 100, status: `Updated ${newFileName}` });
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

    ipcMain.handle('modrinth:resolve-dependencies', async (_, versionId, loaders = [], gameVersions = []) => {
        return await resolveDependenciesInternal(versionId, loaders, gameVersions);
    });
};

module.exports.installModInternal = installModInternal;