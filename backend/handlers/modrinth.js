const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');

const MODRINTH_API = 'https://api.modrinth.com/v2';
const USER_AGENT = 'MCLCAGENT/MinecraftLauncher/1.0 (fernsehheft@pluginhub.de)';
const appData = app.getPath('userData');
const instancesDir = path.join(appData, 'instances');

const getFolderForProjectType = (projectType) => {
    switch (projectType) {
        case 'resourcepack': return 'resourcepacks';
        case 'shader': return 'shaderpacks';
        case 'plugin': return 'plugins';
        default: return 'mods';
    }
};

const SERVER_PLUGIN_SOFTWARE = new Set([
    'bukkit',
    'spigot',
    'paper',
    'purpur',
    'folia',
    'bungeecord',
    'waterfall',
    'velocity'
]);

const SERVER_MOD_SOFTWARE = new Set([
    'forge',
    'neoforge',
    'fabric',
    'quilt',
    'magma',
    'mohist',
    'arclight',
    'ketting',
    'spongeforge',
    'catserver'
]);

const getFolderForServerSoftware = (software, fallbackProjectType) => {
    const normalizedSoftware = String(software || '').toLowerCase();

    if (SERVER_PLUGIN_SOFTWARE.has(normalizedSoftware)) {
        return 'plugins';
    }

    if (SERVER_MOD_SOFTWARE.has(normalizedSoftware)) {
        return 'mods';
    }

    return getFolderForProjectType(fallbackProjectType);
};

// Must match sanitizeFileName in servers.js
function sanitizeFileName(name) {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

const resolveServerSafeName = async (instanceName, explicitSafeName) => {
    if (explicitSafeName && typeof explicitSafeName === 'string') {
        return sanitizeFileName(explicitSafeName);
    }

    const directSafeName = sanitizeFileName(instanceName || '');
    const directConfigPath = path.join(appData, 'servers', directSafeName, 'server.json');
    if (await fs.pathExists(directConfigPath)) {
        return directSafeName;
    }

    const serversDir = path.join(appData, 'servers');
    if (!await fs.pathExists(serversDir)) {
        return directSafeName;
    }

    const dirs = await fs.readdir(serversDir);
    for (const dir of dirs) {
        const configPath = path.join(serversDir, dir, 'server.json');
        if (!await fs.pathExists(configPath)) continue;

        try {
            const config = await fs.readJson(configPath);
            if (config?.name === instanceName || config?.safeName === directSafeName) {
                return dir;
            }
        } catch (_) {
        }
    }

    return directSafeName;
};

const emitServerInstallLog = (win, serverName, message) => {
    try {
        if (!win || !serverName) return;
        win.webContents.send('server:console', {
            serverName,
            log: `[Modrinth Install] ${message}`
        });
    } catch (_) {
    }
};

const installModInternal = async (win, { instanceName, serverSafeName, projectId, versionId, filename, url, projectType, isServer }) => {
    let dest;
    try {
        let folder = getFolderForProjectType(projectType);
        let resolvedServerSoftware = '';

        const baseDir = isServer ? path.join(appData, 'servers') : instancesDir;
        const resolvedName = isServer
            ? await resolveServerSafeName(instanceName, serverSafeName)
            : instanceName;

        if (isServer) {
            const serverJsonPath = path.join(baseDir, resolvedName, 'server.json');
            if (await fs.pathExists(serverJsonPath)) {
                try {
                    const serverConfig = await fs.readJson(serverJsonPath);
                    resolvedServerSoftware = String(serverConfig?.software || '').toLowerCase();
                    folder = getFolderForServerSoftware(resolvedServerSoftware, projectType);
                } catch (readError) {
                    console.warn('[Modrinth:Install] Could not read server config for folder resolution:', readError.message);
                }
            }
        }
        const contentDir = path.join(baseDir, resolvedName, folder);

        console.log(`[Modrinth:Install] Starting install for ${instanceName} (${projectType})`);
        console.log(`[Modrinth:Install] isServer=${!!isServer}, resolvedName=${resolvedName}, software=${resolvedServerSoftware || 'n/a'}, folder=${folder}`);
        console.log(`[Modrinth:Install] contentDir=${contentDir}`);
        if (isServer) {
            emitServerInstallLog(win, instanceName, `Resolving target folder: ${contentDir}`);
        }

        await fs.ensureDir(contentDir);

        const contentDirExists = await fs.pathExists(contentDir);
        console.log(`[Modrinth:Install] contentDir exists after ensureDir: ${contentDirExists}`);
        if (isServer) {
            emitServerInstallLog(win, instanceName, `Target folder exists: ${contentDirExists}`);
        }

        dest = path.join(contentDir, filename);
        console.log(`[Modrinth:Install] destination file: ${dest}`);
        if (isServer) {
            emitServerInstallLog(win, instanceName, `Downloading jar to: ${dest}`);
        }

        if (await fs.pathExists(dest)) {
            if (win) {
                win.webContents.send('install:progress', {
                    instanceName,
                    progress: 100,
                    status: `Skipping ${filename} (already installed)`
                });
            }
            console.log(`[Modrinth:Install] Skipped existing file: ${dest}`);
            if (isServer) {
                emitServerInstallLog(win, instanceName, `File already exists, skipping: ${filename}`);
            }
            return { success: true, skipped: true };
        }

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            headers: { 'User-Agent': USER_AGENT },
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

        const fileExistsAfterDownload = await fs.pathExists(dest);
        console.log(`[Modrinth:Install] File exists after download: ${fileExistsAfterDownload} (${dest})`);
        if (!fileExistsAfterDownload) {
            throw new Error(`Downloaded file not found at expected destination: ${dest}`);
        }

        if (isServer) {
            emitServerInstallLog(win, instanceName, `Download complete: ${filename}`);
        }

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
                                headers: { 'User-Agent': USER_AGENT }
                            });

                            if (res.data && res.data.length > 0) {
                                const latest = res.data[0];
                                const file = latest.files.find(f => f.primary) || latest.files[0];

                                if (!currentFiles.includes(file.filename)) {
                                    const softwareDest = path.join(modsDir, file.filename);
                                    const swWriter = fs.createWriteStream(softwareDest);
                                    const swRes = await axios({
                                        url: file.url,
                                        method: 'GET',
                                        responseType: 'stream',
                                        headers: { 'User-Agent': USER_AGENT }
                                    });
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
        console.error(`[Modrinth:Install] instance=${instanceName}, projectId=${projectId}, versionId=${versionId}, dest=${dest || 'n/a'}`);
        if (isServer) {
            emitServerInstallLog(win, instanceName, `Install failed: ${e.message}`);
            if (dest) {
                emitServerInstallLog(win, instanceName, `Last destination path: ${dest}`);
            }
        }

        if (dest && await fs.pathExists(dest)) {
            try { await fs.unlink(dest); } catch (delErr) { console.warn('[Modrinth] Failed to clean up partial download:', delErr.message); }
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
            const vRes = await axios.get(`${MODRINTH_API}/version/${currentId}`, { headers: { 'User-Agent': USER_AGENT } });
            const version = vRes.data;
            if (!resolved.has(version.project_id)) {

                const pRes = await axios.get(`${MODRINTH_API}/project/${version.project_id}`, { headers: { 'User-Agent': USER_AGENT } });
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
                                const vListRes = await axios.get(`${MODRINTH_API}/project/${dep.project_id}/version`, {
                                    params,
                                    headers: { 'User-Agent': USER_AGENT }
                                });
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
                headers: { 'User-Agent': USER_AGENT }
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
        if (data.projectType === 'mod' || data.projectType === 'plugin') {
            try {
                let loader = 'vanilla';
                let version = '';

                if (data.isServer) {
                    const serversDir = path.join(appData, 'servers');
                    const resolvedSafeName = await resolveServerSafeName(data.instanceName, data.serverSafeName);
                    const serverJsonPath = path.join(serversDir, resolvedSafeName, 'server.json');
                    if (await fs.pathExists(serverJsonPath)) {
                        const serverConfig = await fs.readJson(serverJsonPath);
                        loader = serverConfig.software ? serverConfig.software.toLowerCase() : 'vanilla';
                        version = serverConfig.version;
                    }
                } else {
                    const instanceJsonPath = path.join(instancesDir, data.instanceName, 'instance.json');
                    if (await fs.pathExists(instanceJsonPath)) {
                        const instance = await fs.readJson(instanceJsonPath);
                        loader = instance.loader ? instance.loader.toLowerCase() : 'vanilla';
                        version = instance.version;
                    }
                }

                if (loader !== 'vanilla' && version) {

                    const resolveLoader = ['spigot', 'bukkit', 'purpur', 'folia'].includes(loader) ? 'paper' : loader;

                    const resolveRes = await resolveDependenciesInternal(data.versionId, [resolveLoader], [version]);

                    if (resolveRes.success && resolveRes.dependencies.length > 0) {
                        let successCount = 0;
                        let failCount = 0;
                        for (const dep of resolveRes.dependencies) {
                            const installRes = await installModInternal(win, {
                                instanceName: data.instanceName,
                                serverSafeName: data.serverSafeName,
                                projectId: dep.projectId,
                                versionId: dep.versionId,
                                filename: dep.filename,
                                url: dep.url,
                                projectType: dep.projectType || data.projectType,
                                isServer: data.isServer
                            });

                            if (installRes.success) successCount++;
                            else failCount++;
                        }

                        return { success: failCount === 0 };
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
            const response = await axios.get(`${MODRINTH_API}/project/${projectId}/version`, {
                params,
                headers: { 'User-Agent': USER_AGENT }
            });
            return { success: true, versions: response.data };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('modrinth:update-file', async (_, { instanceName, projectType, oldFileName, newFileName, url, isServer }) => {
        try {
            const folder = getFolderForProjectType(projectType);

            const baseDir = isServer ? path.join(appData, 'servers') : instancesDir;
            const resolvedName = isServer ? sanitizeFileName(instanceName) : instanceName;
            const contentDir = path.join(baseDir, resolvedName, folder);
            const oldPath = path.join(contentDir, oldFileName);
            const newPath = path.join(contentDir, newFileName);

            const writer = fs.createWriteStream(newPath);
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
                headers: { 'User-Agent': USER_AGENT },
                timeout: 30000
            });

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
            const response = await axios.get(`${MODRINTH_API}/project/${projectId}`, {
                headers: { 'User-Agent': USER_AGENT }
            });
            const project = response.data;
            if (project.team) {
                try {
                    const teamRes = await axios.get(`${MODRINTH_API}/team/${project.team}/members`, {
                        headers: { 'User-Agent': USER_AGENT }
                    });
                    if (teamRes.data && teamRes.data.length > 0) {
                        const owner = teamRes.data.find(m => m.role === 'Owner') || teamRes.data[0];
                        project.author = owner.user.username;
                    }
                } catch (e) {
                    console.error("Modrinth Get Team Error:", e.message);
                }
            }

            return { success: true, project };
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