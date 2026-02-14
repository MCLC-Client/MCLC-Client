const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');

const MODRINTH_API = 'https://api.modrinth.com/v2';
const appData = app.getPath('userData');
const instancesDir = path.join(appData, 'instances');

module.exports = (ipcMain) => {
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
            const folder = projectType === 'resourcepack' ? 'resourcepacks' : 'mods';
            const modsDir = path.join(instancesDir, instanceName, folder);
            await fs.ensureDir(modsDir);

            const dest = path.join(modsDir, filename);

            const writer = fs.createWriteStream(dest);
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream'
            });

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            }).then(() => ({ success: true }));

        } catch (e) {
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
};
