const fs = require('fs-extra');
const { Client } = require('minecraft-launcher-core');
const Store = require('electron-store');
const store = new Store();
const path = require('path');
const os = require('os');
const { app, ipcMain, shell, dialog } = require('electron');
console.log('Loaded instances handler. Dialog available:', !!dialog);
const axios = require('axios');
const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);
const crypto = require('crypto');

let appData = app.getPath('userData');
const instancesDir = path.join(appData, 'instances');

async function calculateSha1(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha1');
        const stream = fs.createReadStream(filePath);
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

// Mod Loader Meta APIs
const FABRIC_META = 'https://meta.fabricmc.net/v2';
const QUILT_META = 'https://meta.quiltmc.org/v3';
const FORGE_META = 'https://meta.modrinth.com/forge/v0';
const NEOFORGE_META = 'https://meta.modrinth.com/neo/v0';

// Global registry of active installation tasks
const activeTasks = new Map(); // instanceName -> { abort: () => void }


// Helper to download a file
async function downloadFile(url, destPath) {
    const response = await axios({ url, responseType: 'arraybuffer' });
    await fs.writeFile(destPath, response.data);
}

// Install Fabric loader
async function installFabricLoader(instanceDir, mcVersion, loaderVersion, onProgress, logCallback) {
    const log = (msg) => {
        console.log(msg);
        if (logCallback) logCallback(msg);
    };
    try {
        if (onProgress) onProgress(5, 'Fetching Fabric metadata');
        log('Fetching Fabric metadata...');
        let versionToUse = loaderVersion;
        let versionId;

        if (!versionToUse) {
            const loadersRes = await axios.get(`${FABRIC_META}/versions/loader/${mcVersion}`);
            if (!loadersRes.data || loadersRes.data.length === 0) {
                return { success: false, error: 'No Fabric loader available for this version' };
            }
            versionToUse = loadersRes.data[0].loader.version;
        }

        versionId = `fabric-loader-${versionToUse}-${mcVersion}`;
        log(`Using Fabric loader: ${versionToUse}`);

        // Get the full profile JSON
        if (onProgress) onProgress(15, 'Downloading Fabric profile');
        log('Downloading Fabric profile...');
        const profileRes = await axios.get(`${FABRIC_META}/versions/loader/${mcVersion}/${versionToUse}/profile/json`);
        const profile = profileRes.data;

        const versionsDir = path.join(instanceDir, 'versions', versionId);
        await fs.ensureDir(versionsDir);
        await fs.writeJson(path.join(versionsDir, `${versionId}.json`), profile, { spaces: 2 });

        log(`Installed Fabric ${versionToUse} for MC ${mcVersion} -> ${versionId}`);
        if (onProgress) onProgress(25, 'Fabric profile saved');
        return { success: true, loaderVersion: versionToUse, versionId };
    } catch (e) {
        console.error('Fabric install error:', e.message);
        if (logCallback) logCallback(`Fabric install error: ${e.message}`);
        return { success: false, error: e.message };
    }
}

// Install Quilt loader for a specific MC version
async function installQuiltLoader(instanceDir, mcVersion, loaderVersion, onProgress, logCallback) {
    const log = (msg) => {
        console.log(msg);
        if (logCallback) logCallback(msg);
    };
    try {
        if (onProgress) onProgress(5, 'Fetching Quilt metadata');
        log('Fetching Quilt metadata...');
        let versionToUse = loaderVersion;
        let versionId;

        if (!versionToUse) {
            const loadersRes = await axios.get(`${QUILT_META}/versions/loader/${mcVersion}`);
            if (!loadersRes.data || loadersRes.data.length === 0) {
                return { success: false, error: 'No Quilt loader available for this version' };
            }
            versionToUse = loadersRes.data[0].loader.version;
        }

        versionId = `quilt-loader-${versionToUse}-${mcVersion}`;
        log(`Using Quilt loader: ${versionToUse}`);

        // Get profile JSON
        if (onProgress) onProgress(15, 'Downloading Quilt profile');
        log('Downloading Quilt profile...');
        const profileRes = await axios.get(`${QUILT_META}/versions/loader/${mcVersion}/${versionToUse}/profile/json`);
        const profile = profileRes.data;

        const versionsDir = path.join(instanceDir, 'versions', versionId);
        await fs.ensureDir(versionsDir);
        await fs.writeJson(path.join(versionsDir, `${versionId}.json`), profile, { spaces: 2 });

        log(`Installed Quilt ${versionToUse} for MC ${mcVersion}`);
        if (onProgress) onProgress(25, 'Quilt profile saved');
        return { success: true, loaderVersion: versionToUse, versionId };
    } catch (e) {
        console.error('Quilt install error:', e.message);
        if (logCallback) logCallback(`Quilt install error: ${e.message}`);
        return { success: false, error: e.message };
    }
}

// Helper to extract version.json from installer
async function extractVersionUid(installerPath, filesToLookFor = ['version.json', 'install_profile.json']) {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(installerPath);
    const zipEntries = zip.getEntries();

    // Look for version.json first (modern)
    let entry = zipEntries.find(e => e.entryName === 'version.json');
    if (entry) {
        return JSON.parse(entry.getData().toString('utf8'));
    }

    // Fallback to install_profile.json (it often contains version info structure too)
    entry = zipEntries.find(e => e.entryName === 'install_profile.json');
    if (entry) {
        const profile = JSON.parse(entry.getData().toString('utf8'));
        if (profile.versionInfo) return profile.versionInfo;
    }

    return null;
}

// Fetch Maven Metadata to get versions
async function fetchMavenVersions(metadataUrl) {
    try {
        const res = await axios.get(metadataUrl);
        const xml = res.data;
        // Simple regex to parse versions from XML
        const versions = [];
        const regex = /<version>(.*?)<\/version>/g;
        let match;
        while ((match = regex.exec(xml)) !== null) {
            versions.push(match[1]);
        }
        return versions.reverse(); // Newest first
    } catch (e) {
        console.error(`Failed to fetch metadata from ${metadataUrl}`, e.message);
        return [];
    }
}

// Helper to run Java installer headlessly
async function runInstaller(installerPath, instanceDir, onProgress, logCallback) {
    // Forge/NeoForge installer requires a launcher_profiles.json to exist in the target directory
    // even if we are not actually using the official launcher.
    const profilePath = path.join(instanceDir, 'launcher_profiles.json');
    if (!await fs.pathExists(profilePath)) {
        console.log('Creating dummy launcher_profiles.json for installer...');
        const dummyProfile = {
            profiles: {},
            settings: {
                crashAssistance: true,
                enableAdvanced: true,
                enableAnalytics: true,
                enableHistorical: true,
                enableReleases: true,
                enableSnapshots: true,
                keepLauncherOpen: false,
                locale: 'en-us',
                profileSorting: 'last_played',
                showGameLog: false,
                showMenu: false,
                soundOn: false
            },
            version: 3
        };
        await fs.ensureDir(instanceDir);
        await fs.writeJson(profilePath, dummyProfile, { spaces: 2 });
    }

    const log = (msg) => {
        console.log(msg);
        if (logCallback) logCallback(msg);
    };

    return new Promise((resolve, reject) => {
        const { spawn } = require('child_process');
        console.log(`Running installer: java -jar "${installerPath}" --installClient "${instanceDir}"`);
        const child = spawn('java', ['-jar', installerPath, '--installClient', instanceDir]);

        // Register this child process so it can be killed if needed
        const instanceName = path.basename(instanceDir);
        if (activeTasks.has(instanceName)) {
            activeTasks.get(instanceName).child = child;
        }

        child.stdout.on('data', (data) => {
            const str = data.toString();
            log(`[Installer]: ${str.trim()}`);
            if (onProgress) {
                // Try to extract some meaningful status from installer output
                if (str.includes('Downloading')) onProgress(null, 'Downloading libraries...');
                if (str.includes('Extracting')) onProgress(null, 'Extracting files...');
                if (str.includes('Processing')) onProgress(null, 'Processing JARs...');
            }
        });
        child.stderr.on('data', (data) => log(`[Installer ERROR]: ${data.toString().trim()}`));

        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Installer exited with code ${code}`));
        });
    });
}

// Install Forge loader using Official Installer
async function installForgeLoader(instanceDir, mcVersion, loaderVersion, onProgress, logCallback) {
    const log = (msg) => {
        console.log(msg);
        if (logCallback) logCallback(msg);
    };
    try {
        if (onProgress) onProgress(5, `Preparing Forge ${loaderVersion}`);
        console.log(`Installing Forge ${loaderVersion} for MC ${mcVersion}...`);

        let fullVersion = loaderVersion;
        if (!fullVersion.startsWith(mcVersion)) {
            fullVersion = `${mcVersion}-${loaderVersion}`;
        }

        const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullVersion}/forge-${fullVersion}-installer.jar`;
        const installerPath = path.join(os.tmpdir(), `forge-${fullVersion}-installer.jar`);

        console.log(`Downloading Maven Installer: ${installerUrl}`);
        if (onProgress) onProgress(10, 'Downloading Forge Installer');
        try {
            await downloadFile(installerUrl, installerPath);
        } catch (e) {
            return { success: false, error: `Failed to download Forge installer from ${installerUrl}: ${e.message}` };
        }

        log('Running Forge Installer headlessly...');
        if (onProgress) onProgress(30, 'Running Forge Installer (this may take a minute)');
        try {
            await runInstaller(installerPath, instanceDir, (p, s) => {
                if (onProgress) onProgress(p || 50, s); // Keep at 50% during install if no p
            }, logCallback);
        } catch (e) {
            return { success: false, error: `Forge installation failed: ${e.message}` };
        }

        console.log('Extracting version.json for MCLC compatibility...');
        if (onProgress) onProgress(80, 'Extracting version profile...');
        const versionProfile = await extractVersionUid(installerPath);

        if (!versionProfile) {
            return { success: false, error: 'Could not find version.json in Forge installer' };
        }

        const versionId = versionProfile.id;
        const versionsDir = path.join(instanceDir, 'versions', versionId);
        await fs.ensureDir(versionsDir);
        await fs.writeJson(path.join(versionsDir, `${versionId}.json`), versionProfile, { spaces: 2 });

        // Cleanup
        await fs.remove(installerPath);

        console.log(`Successfully installed Forge ${versionId}`);
        if (onProgress) onProgress(95, 'Finalizing Forge installation...');
        return { success: true, loaderVersion: loaderVersion, versionId };
    } catch (e) {
        console.error('Forge install error:', e.message);
        return { success: false, error: e.message };
    }
}



// Install NeoForge loader using Official Installer
async function installNeoForgeLoader(instanceDir, mcVersion, loaderVersion, onProgress, logCallback) {
    const log = (msg) => {
        console.log(msg);
        if (logCallback) logCallback(msg);
    };
    try {
        if (onProgress) onProgress(5, `Preparing NeoForge ${loaderVersion}`);
        console.log(`Installing NeoForge ${loaderVersion} for MC ${mcVersion}...`);

        const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${loaderVersion}/neoforge-${loaderVersion}-installer.jar`;
        const installerPath = path.join(os.tmpdir(), `neoforge-${loaderVersion}-installer.jar`);

        console.log(`Downloading NeoForge Installer: ${installerUrl}`);
        if (onProgress) onProgress(10, 'Downloading NeoForge Installer');
        try {
            await downloadFile(installerUrl, installerPath);
        } catch (e) {
            return { success: false, error: `Failed to download NeoForge installer: ${e.message}` };
        }

        log('Running NeoForge Installer headlessly...');
        if (onProgress) onProgress(30, 'Running NeoForge Installer');
        try {
            await runInstaller(installerPath, instanceDir, (p, s) => {
                if (onProgress) onProgress(p || 50, s);
            }, logCallback);
        } catch (e) {
            return { success: false, error: `NeoForge installation failed: ${e.message}` };
        }

        console.log('Extracting version.json for MCLC compatibility...');
        const versionProfile = await extractVersionUid(installerPath);

        if (!versionProfile) {
            return { success: false, error: 'Could not find version.json in NeoForge installer' };
        }

        const versionId = versionProfile.id;
        const versionsDir = path.join(instanceDir, 'versions', versionId);
        await fs.ensureDir(versionsDir);
        await fs.writeJson(path.join(versionsDir, `${versionId}.json`), versionProfile, { spaces: 2 });

        // Cleanup
        await fs.remove(installerPath);

        console.log(`Successfully installed NeoForge ${versionId}`);
        if (onProgress) onProgress(95, 'Finalizing NeoForge installation...');
        return { success: true, loaderVersion: loaderVersion, versionId };
    } catch (e) {
        console.error('NeoForge install error:', e.message);
        return { success: false, error: e.message };
    }
}

module.exports = (ipcMain, win) => {
    console.log('--- INSTANCES HANDLER INIT START ---');
    console.log('[Instances] Registering Instance Handlers...');

    const DEFAULT_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'%3E%3C/path%3E%3Cpolyline points='3.27 6.96 12 12.01 20.73 6.96'%3E%3C/polyline%3E%3Cline x1='12' y1='22.08' x2='12' y2='12'%3E%3C/line%3E%3C/svg%3E";

    ipcMain.handle('instance:get-resourcepacks', async (_, instanceName) => {
        console.log(`[Instances:RP] Getting resource packs for: ${instanceName}`);
        try {
            const rpDir = path.join(instancesDir, instanceName, 'resourcepacks');
            await fs.ensureDir(rpDir);

            const modCachePath = path.join(appData, 'mod_cache.json');
            let modCache = {};
            try {
                if (await fs.pathExists(modCachePath)) {
                    modCache = await fs.readJson(modCachePath);
                }
            } catch (e) { console.error('Failed to load cache for RPs', e); }

            const files = await fs.readdir(rpDir, { withFileTypes: true });

            const rpObjects = (await Promise.all(files.map(async (dirent) => {
                try {
                    const fileName = dirent.name;
                    const filePath = path.join(rpDir, fileName);

                    const isPack = dirent.isDirectory() ||
                        fileName.toLowerCase().endsWith('.zip') ||
                        fileName.toLowerCase().endsWith('.rar');

                    if (!isPack) return null;

                    const stats = await fs.stat(filePath);
                    let title = null, icon = null, version = null;

                    const cacheKey = `${fileName}-${stats.size}`;
                    if (modCache[cacheKey] && modCache[cacheKey].projectId) {
                        title = modCache[cacheKey].title;
                        icon = modCache[cacheKey].icon;
                        version = modCache[cacheKey].version;
                    } else if (dirent.isFile()) {
                        try {
                            const hash = await calculateSha1(filePath);
                            const res = await axios.get(`https://api.modrinth.com/v2/version_file/${hash}`, {
                                headers: { 'User-Agent': 'Client/MCLC/1.0 (fernsehheft@pluginhub.de)' },
                                timeout: 3000
                            });
                            const versionData = res.data;
                            const versionId = versionData.id;
                            const projectId = versionData.project_id;

                            const projectRes = await axios.get(`https://api.modrinth.com/v2/project/${projectId}`, {
                                headers: { 'User-Agent': 'Client/MCLC/1.0 (fernsehheft@pluginhub.de)' },
                                timeout: 3000
                            });
                            const projectData = projectRes.data;

                            title = projectData.title;
                            icon = projectData.icon_url;
                            version = versionData.version_number;

                            modCache[cacheKey] = { title, icon, version, projectId, versionId, hash };
                        } catch (e) { /* silent metadata fail */ }
                    }

                    return {
                        name: fileName,
                        title: title || fileName,
                        icon,
                        version,
                        projectId: modCache[cacheKey]?.projectId,
                        versionId: modCache[cacheKey]?.versionId,
                        size: stats.size,
                        enabled: true
                    };
                } catch (e) {
                    console.error(`Error processing resource pack:`, e);
                    return null;
                }
            }))).filter(p => p !== null);

            await fs.writeJson(modCachePath, modCache).catch(() => { });

            return { success: true, packs: rpObjects };
        } catch (e) {
            console.error('Failed to get resource packs', e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('instance:get-shaders', async (_, instanceName) => {
        console.log(`[Instances:Shaders] Getting shaders for: ${instanceName}`);
        try {
            const shaderDir = path.join(instancesDir, instanceName, 'shaderpacks');
            await fs.ensureDir(shaderDir);

            const modCachePath = path.join(appData, 'mod_cache.json');
            let modCache = {};
            try {
                if (await fs.pathExists(modCachePath)) {
                    modCache = await fs.readJson(modCachePath);
                }
            } catch (e) { console.error('Failed to load cache for shaders', e); }

            const files = await fs.readdir(shaderDir, { withFileTypes: true });

            const shaderObjects = (await Promise.all(files.map(async (dirent) => {
                try {
                    const fileName = dirent.name;
                    const filePath = path.join(shaderDir, fileName);

                    const isShader = dirent.isDirectory() ||
                        fileName.toLowerCase().endsWith('.zip');

                    if (!isShader) return null;

                    const stats = await fs.stat(filePath);
                    let title = null, icon = null, version = null;

                    const cacheKey = `${fileName}-${stats.size}`;
                    if (modCache[cacheKey] && modCache[cacheKey].projectId) {
                        title = modCache[cacheKey].title;
                        icon = modCache[cacheKey].icon;
                        version = modCache[cacheKey].version;
                    } else if (dirent.isFile()) {
                        try {
                            const hash = await calculateSha1(filePath);
                            const res = await axios.get(`https://api.modrinth.com/v2/version_file/${hash}`, {
                                headers: { 'User-Agent': 'Client/MCLC/1.0 (fernsehheft@pluginhub.de)' },
                                timeout: 3000
                            });
                            const versionData = res.data;
                            const versionId = versionData.id;
                            const projectId = versionData.project_id;

                            const projectRes = await axios.get(`https://api.modrinth.com/v2/project/${projectId}`, {
                                headers: { 'User-Agent': 'Client/MCLC/1.0 (fernsehheft@pluginhub.de)' },
                                timeout: 3000
                            });
                            const projectData = projectRes.data;

                            title = projectData.title;
                            icon = projectData.icon_url;
                            version = versionData.version_number;

                            modCache[cacheKey] = { title, icon, version, projectId, versionId, hash };
                        } catch (e) { /* silent metadata fail */ }
                    }

                    return {
                        name: fileName,
                        title: title || fileName,
                        icon,
                        version,
                        projectId: modCache[cacheKey]?.projectId,
                        versionId: modCache[cacheKey]?.versionId,
                        size: stats.size,
                        enabled: true
                    };
                } catch (e) {
                    console.error(`Error processing shader:`, e);
                    return null;
                }
            }))).filter(p => p !== null);

            await fs.writeJson(modCachePath, modCache).catch(() => { });

            return { success: true, shaders: shaderObjects };
        } catch (e) {
            console.error('Failed to get shaders', e);
            return { success: false, error: e.message };
        }
    });

    // Background installation functions (Available to all handlers in this scope)
    const startBackgroundInstall = async (finalName, config, cleanInstall = false, isMigration = false) => {
        const dir = path.join(instancesDir, finalName);
        const { version, loader, loaderVersion: existingLoaderVer } = config;

        console.log(`[Background Install] Starting for ${finalName}, clean=${cleanInstall}, migration=${isMigration}`);

        // Register task for abort capability
        activeTasks.set(finalName, {
            aborted: false,
            child: null,
            abort: () => {
                const task = activeTasks.get(finalName);
                if (task) {
                    task.aborted = true;
                    if (task.child) {
                        try {
                            task.child.kill();
                        } catch (e) { console.error('Failed to kill installer child:', e); }
                    }
                }
            }
        });

        // Start background installation
        (async () => {
            const task = activeTasks.get(finalName);
            if (!task) return;

            try {
                // Helper to append to logs
                const logsPath = path.join(dir, 'install.log');
                await fs.ensureDir(path.dirname(logsPath));
                await fs.appendFile(logsPath, `\n--- ${isMigration ? 'Migration' : 'Installation'} Started: ${new Date().toLocaleString()} ---\n`);

                const appendLog = async (line) => {
                    if (task.aborted) return;
                    const formatted = `[${new Date().toLocaleTimeString()}] ${line}\n`;
                    await fs.appendFile(logsPath, formatted);
                    if (win && win.webContents) {
                        win.webContents.send('launch:log', line);
                    }
                };

                const sendProgress = (progress, status) => {
                    if (task.aborted) return;
                    if (status) appendLog(`Status: ${status}`);
                    if (win && win.webContents) {
                        win.webContents.send('install:progress', { instanceName: finalName, progress, status });
                    }
                };

                const sendCompletion = async (success, error = null) => {
                    if (task.aborted) return;
                    try {
                        const configPath = path.join(dir, 'instance.json');
                        const updatedConfig = await fs.readJson(configPath);
                        updatedConfig.status = success ? 'ready' : 'error';
                        await fs.writeJson(configPath, updatedConfig, { spaces: 4 });
                    } catch (e) { console.error('Failed to update instance config:', e); }

                    if (win && win.webContents) {
                        sendProgress(100, success ? 'Completed' : 'Failed');
                        await new Promise(resolve => setTimeout(resolve, 500));
                        if (success) {
                            win.webContents.send('instance:status', { instanceName: finalName, status: 'stopped' });
                        } else {
                            win.webContents.send('instance:status', { instanceName: finalName, status: 'error', error });
                        }
                    }
                };

                // Phase 0: Mod Migration (If migrating)
                let modsToInstall = [];
                if (isMigration) {
                    sendProgress(2, 'Analyzing current mods for migration...');
                    const modsDir = path.join(dir, 'mods');
                    if (await fs.pathExists(modsDir)) {
                        const files = await fs.readdir(modsDir);
                        const jars = files.filter(f => f.endsWith('.jar'));

                        for (const jar of jars) {
                            if (task.aborted) break;
                            const jarPath = path.join(modsDir, jar);
                            try {
                                const hash = await calculateSha1(jarPath);
                                sendProgress(null, `Checking compatibility: ${jar}`);

                                // Lookup mod on Modrinth
                                try {
                                    const res = await axios.get(`https://api.modrinth.com/v2/version_file/${hash}`);
                                    const currentVersion = res.data;
                                    const projectId = currentVersion.project_id;

                                    // Search for NEW version
                                    const loaders = [loader.toLowerCase()];
                                    const gameVersions = [version];

                                    const searchUrl = `https://api.modrinth.com/v2/project/${projectId}/version?loaders=["${loaders.join('","')}"]&game_versions=["${gameVersions.join('","')}"]`;
                                    const versionsRes = await axios.get(searchUrl);
                                    const availableVersions = versionsRes.data;

                                    if (availableVersions && availableVersions.length > 0) {
                                        const bestVersion = availableVersions[0]; // Assuming newest first
                                        const primaryFile = bestVersion.files.find(f => f.primary) || bestVersion.files[0];
                                        modsToInstall.push({
                                            name: primaryFile.filename,
                                            url: primaryFile.url,
                                            oldJar: jar
                                        });
                                        appendLog(`Found compatible version for ${jar}: ${bestVersion.version_number}`);
                                    } else {
                                        appendLog(`No compatible version found for ${jar} on ${loader} ${version}. Mod will be removed.`);
                                        await fs.remove(jarPath);
                                    }
                                } catch (e) {
                                    appendLog(`Mod ${jar} not found on Modrinth or API error. Removing to prevent crashes.`);
                                    await fs.remove(jarPath);
                                }
                            } catch (e) {
                                appendLog(`Failed to process ${jar}: ${e.message}`);
                            }
                        }

                        // Clean up ALL jars initially if we are doing a fresh mod install phase
                        // Actually, we already removed incompatible ones. Let's remove the ones we matched too to replace them.
                        for (const mod of modsToInstall) {
                            await fs.remove(path.join(modsDir, mod.oldJar));
                        }
                    }
                }

                let result = { success: true };
                const loaderType = (loader || 'vanilla').toLowerCase();

                // Phase 1: Base Game Download
                sendProgress(10, `Downloading Minecraft ${version} base files (Phase 1/3)...`);
                try {
                    const versionManifestUrl = 'https://piston-meta.mojang.com/mc/game/version_manifest.json';
                    const manifestPath = path.join(dir, 'version_manifest.json');
                    await downloadFile(versionManifestUrl, manifestPath);
                    const manifest = await fs.readJson(manifestPath);
                    const versionData = manifest.versions.find(v => v.id === version);

                    if (!versionData) throw new Error(`Version ${version} not found in manifest`);

                    const versionJsonUrl = versionData.url;
                    const versionDir = path.join(dir, 'versions', version);
                    await fs.ensureDir(versionDir);
                    const versionJsonPath = path.join(versionDir, `${version}.json`);

                    await downloadFile(versionJsonUrl, versionJsonPath);
                    const clientJarPath = path.join(versionDir, `${version}.jar`);
                    const versionJson = await fs.readJson(versionJsonPath);
                    await downloadFile(versionJson.downloads.client.url, clientJarPath);
                    await fs.remove(manifestPath);
                } catch (e) {
                    appendLog(`Warning: Base game files check/download: ${e.message}`);
                }

                // Phase 2: Mod Loader Installation
                if (loaderType !== 'vanilla') {
                    sendProgress(20, `Installing ${loader} loader (Phase 2/3)...`);
                    let targetLoaderVer = existingLoaderVer;
                    if (loaderType === 'fabric') result = await installFabricLoader(dir, version, targetLoaderVer, (p, s) => sendProgress(Math.round(p * 0.1) + 20, s), appendLog);
                    else if (loaderType === 'quilt') result = await installQuiltLoader(dir, version, targetLoaderVer, (p, s) => sendProgress(Math.round(p * 0.1) + 20, s), appendLog);
                    else if (loaderType === 'forge') result = await installForgeLoader(dir, version, targetLoaderVer, (p, s) => sendProgress(Math.round(p * 0.1) + 20, s), appendLog);
                    else if (loaderType === 'neoforge') result = await installNeoForgeLoader(dir, version, targetLoaderVer, (p, s) => sendProgress(Math.round(p * 0.1) + 20, s), appendLog);

                    if (!result || !result.success) throw new Error(result?.error || `${loader} installation failed`);

                    // --- Auto-Fabric API Installation ---
                    if (loaderType === 'fabric') {
                        try {
                            sendProgress(35, 'Auto-installing Fabric API...');
                            const fabricApiId = 'P7dR8mSH';
                            const fapiRes = await axios.get(`https://api.modrinth.com/v2/project/${fabricApiId}/version`, {
                                params: {
                                    loaders: JSON.stringify(['fabric']),
                                    game_versions: JSON.stringify([version])
                                }
                            });

                            if (fapiRes.data && fapiRes.data.length > 0) {
                                const latest = fapiRes.data[0];
                                const file = latest.files.find(f => f.primary) || latest.files[0];
                                const modsDir = path.join(dir, 'mods');
                                await fs.ensureDir(modsDir);
                                const dest = path.join(modsDir, file.filename);

                                if (!await fs.pathExists(dest)) {
                                    appendLog(`Downloading Fabric API compatible with ${version}...`);
                                    await downloadFile(file.url, dest);
                                    appendLog(`Fabric API installed: ${file.filename}`);
                                }
                            }
                        } catch (fapiErr) {
                            appendLog(`Warning: Failed to auto-install Fabric API: ${fapiErr.message}`);
                        }
                    }

                    const configPath = path.join(dir, 'instance.json');
                    const updatedConfig = await fs.readJson(configPath);
                    updatedConfig.loaderVersion = result.loaderVersion;
                    updatedConfig.versionId = result.versionId;
                    await fs.writeJson(configPath, updatedConfig, { spaces: 4 });
                }

                // Phase 3: Assets & Libraries
                sendProgress(40, 'Finalizing game files...');
                // ... (Existing Asset/Lib Logic) ...
                // Note: Reusing existing logic but wrapped in this block
                const baseProgressStart = 40;
                try {
                    const sharedDir = path.join(app.getPath('userData'), 'common');
                    const assetRoot = path.join(sharedDir, 'assets');
                    const librariesRoot = path.join(dir, 'libraries');
                    await fs.ensureDir(assetRoot); await fs.ensureDir(librariesRoot);

                    const currentConfig = await fs.readJson(path.join(dir, 'instance.json'));
                    const vId = currentConfig.versionId || version;
                    const vJsonPath = path.join(dir, 'versions', vId, `${vId}.json`);
                    const vJson = await fs.readJson(vJsonPath);

                    const libraries = vJson.libraries || [];
                    let downloaded = 0;
                    for (const lib of libraries) {
                        if (task.aborted) break;
                        // Skip complex rule parsing for brevity in this block, assume MCLC or similar logic
                        if (lib.downloads && lib.downloads.artifact) {
                            const art = lib.downloads.artifact;
                            const dest = path.join(librariesRoot, art.path);
                            if (!await fs.pathExists(dest)) {
                                await fs.ensureDir(path.dirname(dest));
                                await downloadFile(art.url, dest);
                            }
                        }
                        downloaded++;
                        sendProgress(Math.round(baseProgressStart + (downloaded / libraries.length) * 30), `Syncing libraries...`);
                    }
                } catch (e) { appendLog(`Library sync warning: ${e.message}`); }

                // Phase 4: Install Migrated Mods
                if (modsToInstall.length > 0) {
                    sendProgress(80, `Installing ${modsToInstall.length} migrated mods...`);
                    const modsDir = path.join(dir, 'mods');
                    await fs.ensureDir(modsDir);
                    for (const mod of modsToInstall) {
                        if (task.aborted) break;
                        const dest = path.join(modsDir, mod.name);
                        appendLog(`Downloading migrated mod: ${mod.name}`);
                        await downloadFile(mod.url, dest);
                    }
                }

                sendCompletion(true);
            } catch (err) {
                console.error(`Background ${isMigration ? 'migration' : 'install'} error:`, err);
                sendCompletion(false, err.message);
            } finally {
                activeTasks.delete(finalName);
            }
        })();
    };

    ipcMain.handle('instance:get-all', async () => {
        try {
            if (!await fs.pathExists(instancesDir)) return [];
            const dirs = await fs.readdir(instancesDir);
            const instances = [];
            for (const dir of dirs) {
                const configPath = path.join(instancesDir, dir, 'instance.json');
                if (await fs.pathExists(configPath)) {
                    try {
                        const config = await fs.readJson(configPath);
                        // Ensure name is consistent with folder if missing? 
                        // Usually instance.json has the name.
                        instances.push(config);
                    } catch (e) {
                        console.error(`Failed to read instance config for ${dir}:`, e);
                    }
                }
            }
            return instances;
        } catch (e) {
            console.error('Failed to list instances:', e);
            return [];
        }
    });

    ipcMain.handle('instance:get-log-files', async (_, instanceName) => {
        try {
            console.log(`Getting log files for: ${instanceName}`);
            const instanceDir = path.join(instancesDir, instanceName);
            const logsDir = path.join(instanceDir, 'logs');
            const logFiles = [];

            // Add install.log from root if it exists
            const installLogPath = path.join(instanceDir, 'install.log');
            if (await fs.pathExists(installLogPath)) {
                const stats = await fs.stat(installLogPath);
                logFiles.push({
                    name: 'install.log',
                    date: stats.mtime,
                    size: stats.size
                });
            }

            if (await fs.pathExists(logsDir)) {
                const files = await fs.readdir(logsDir);
                for (const file of files) {
                    if (file.endsWith('.log') || file.endsWith('.log.gz')) {
                        const stats = await fs.stat(path.join(logsDir, file));
                        logFiles.push({
                            name: file,
                            date: stats.mtime,
                            size: stats.size
                        });
                    }
                }
            }

            return logFiles.sort((a, b) => b.date - a.date);
        } catch (e) {
            console.error('Error getting log files:', e);
            return [];
        }
    });

    ipcMain.handle('instance:get-worlds', async (_, instanceName) => {
        try {
            console.log(`Getting worlds for: ${instanceName}`);
            const instanceDir = path.join(instancesDir, instanceName);
            const savesDir = path.join(instanceDir, 'saves');
            if (!await fs.pathExists(savesDir)) return { success: true, worlds: [] };

            const worlds = [];
            const dirs = await fs.readdir(savesDir);

            for (const dir of dirs) {
                const worldPath = path.join(savesDir, dir);
                const stats = await fs.stat(worldPath);
                if (stats.isDirectory()) {
                    worlds.push({
                        name: dir,
                        lastPlayed: stats.mtime,
                        folder: true
                    });
                }
            }

            return { success: true, worlds: worlds.sort((a, b) => b.lastPlayed - a.lastPlayed) };
        } catch (e) {
            console.error('Error getting worlds:', e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('instance:get-log', async (_, instanceName, filename) => {
        try {
            const instanceDir = path.join(instancesDir, instanceName);
            // install.log is in the root, others are in logs/
            const logPath = filename === 'install.log'
                ? path.join(instanceDir, filename)
                : path.join(instanceDir, 'logs', filename);

            if (!await fs.pathExists(logPath)) return { success: false, error: 'Log file not found' };

            let content;
            if (filename.endsWith('.gz')) {
                const buffer = await fs.readFile(logPath);
                const decompressed = await gunzip(buffer);
                content = decompressed.toString('utf8');
            } else {
                content = await fs.readFile(logPath, 'utf8');
            }

            return { success: true, content };
        } catch (e) {
            console.error('Error reading log:', e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('instance:create', async (_, { name, version, loader, loaderVersion, icon }) => {
        try {
            let finalName = name;
            let dir = path.join(instancesDir, finalName);
            let counter = 1;

            // Auto-increment name if it exists
            while (await fs.pathExists(dir)) {
                finalName = `${name} (${counter})`;
                dir = path.join(instancesDir, finalName);
                counter++;
            }

            await fs.ensureDir(dir);

            // Copy settings from another instance if enabled
            try {
                const settingsPath = path.join(appData, 'settings.json');
                if (await fs.pathExists(settingsPath)) {
                    const settings = await fs.readJson(settingsPath);
                    if (settings.copySettingsEnabled && settings.copySettingsSourceInstance) {
                        const sourceDir = path.join(instancesDir, settings.copySettingsSourceInstance);
                        if (await fs.pathExists(sourceDir)) {
                            console.log(`Copying settings from ${settings.copySettingsSourceInstance} to ${finalName}`);
                            const filesToCopy = ['options.txt', 'optionsof.txt'];
                            for (const file of filesToCopy) {
                                const srcFile = path.join(sourceDir, file);
                                if (await fs.pathExists(srcFile)) {
                                    await fs.copy(srcFile, path.join(dir, file));
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to copy settings:', e);
            }

            // ALL instances start with 'installing' status - including Vanilla
            // This ensures consistent UI behavior across all loader types
            const config = {
                name: finalName,
                version, // e.g., "1.20.1"
                loader: loader || 'vanilla',
                loaderVersion: null, // Will be updated after background install
                versionId: version, // Initial fallback
                icon: icon || null,
                created: Date.now(),
                playtime: 0,
                lastPlayed: null,
                status: 'installing' // Always start as installing
            };

            await fs.writeJson(path.join(dir, 'instance.json'), config, { spaces: 4 });
            await fs.writeFile(path.join(dir, 'playtime.txt'), '0');

            // Send immediate status update to UI
            console.log(`[Instance Create] Sending installing status for ${finalName}`);
            if (win && win.webContents) {
                win.webContents.send('instance:status', { instanceName: finalName, status: 'installing' });
                win.webContents.send('install:progress', { instanceName: finalName, progress: 1, status: 'Initializing...' });
                console.log(`[Instance Create] Sent IPC events for ${finalName}`);
            } else {
                console.error(`[Instance Create] win not available for ${finalName}!`);
            }


            // ---------------------------------------------------------
            // Instance Create with Refactored logic
            // ---------------------------------------------------------
            await startBackgroundInstall(finalName, {
                version,
                loader,
                loaderVersion
            });

            return { success: true, instanceName: finalName };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    console.log('Registering instance:reinstall handler...');
    ipcMain.handle('instance:reinstall', async (_, instanceName, type = 'soft') => {
        try {
            console.log(`[Instance Reinstall] ${instanceName}, type: ${type}`);
            const dir = path.join(instancesDir, instanceName);
            if (!await fs.pathExists(dir)) return { success: false, error: 'Instance not found' };

            const configPath = path.join(dir, 'instance.json');
            if (!await fs.pathExists(configPath)) return { success: false, error: 'Config missing' };

            const config = await fs.readJson(configPath);
            // Ensure status is installing
            config.status = 'installing';
            await fs.writeJson(configPath, config, { spaces: 4 });

            // Notify UI
            win.webContents.send('instance:status', { instanceName, status: 'installing' });

            // Hard Reinstall: Delete everything in dir except instance.json 
            if (type === 'hard') {
                console.log(`[Instance Reinstall] Performing HARD reinstall (wiping directory)`);
                const files = await fs.readdir(dir);
                for (const file of files) {
                    if (file === 'instance.json') continue;
                    // Maybe keep screenshots/saves? User said "all files deleted".
                    // Let's protect nothing else based on request "alle datein werden gelöscht".
                    await fs.remove(path.join(dir, file));
                }
            }

            // Start background install
            // Pass existing config so it reinstalls the same versions

            await startBackgroundInstall(instanceName, config, type === 'hard');

            return { success: true };

        } catch (e) {
            return { success: false, error: e.message };
        }
    });


    ipcMain.handle('instance:get-loader-versions', async (_, loader, mcVersion) => {
        try {
            if (!loader || !mcVersion) return { success: false, error: 'Missing arguments' };
            const loaderName = loader.toLowerCase();

            if (loaderName === 'fabric') {
                const res = await axios.get(`${FABRIC_META}/versions/loader/${mcVersion}`);
                return { success: true, versions: res.data.map(v => v.loader) };
            } else if (loaderName === 'quilt') {
                const res = await axios.get(`${QUILT_META}/versions/loader/${mcVersion}`);
                return { success: true, versions: res.data.map(v => v.loader) };
            } else if (loaderName === 'forge') {
                // Fetch from Official Maven Metadata to get ALL versions
                // Using promotions_slim is faster but partial. Metadata is huge.
                // Let's use the maven metadata XML
                const versions = await fetchMavenVersions('https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml');

                // Filter by MC version
                // Forge versions usually start with mcVersion-
                // e.g. 1.18.1-39.1.2
                const filtered = versions.filter(v => v.startsWith(mcVersion + '-'))
                    .map(v => {
                        // extract the forge part: 1.18.1-39.1.2 -> 39.1.2
                        // or just return the full thing?
                        // The installer expects key logic.
                        // Let's simpler filtering: v.replace(mcVersion + '-', '')
                        return v.replace(mcVersion + '-', '');
                    });

                // Fallback to Modrinth if list is empty (maybe parsing failed?)
                if (filtered.length === 0) {
                    // ... fallback logic or return empty
                    // Actually let's try promotions if metadata fails/is too big/format differs
                    // Promotions: https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json
                    try {
                        const promoRes = await axios.get('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
                        const promos = promoRes.data.promos;
                        // entries like "1.18.1-latest": "39.1.2"
                        const relevant = Object.entries(promos).filter(([k]) => k.startsWith(mcVersion + '-'));
                        return {
                            success: true,
                            versions: relevant.map(([_, v]) => ({ version: v, stable: false }))
                        };
                    } catch (e) { }
                }

                return {
                    success: true,
                    versions: filtered.map(v => ({ version: v, stable: false }))
                };

            } else if (loaderName === 'neoforge') {
                // Fetch from NeoForge Maven
                const versions = await fetchMavenVersions('https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml');

                // NeoForge versioning: 
                // Old: 1.20.1-47.1.3
                // New: 20.2.5 (Matches MC version 1.20.2)

                // We need to filter based on mcVersion.
                // If mcVersion is 1.20.4, look for 20.4.x
                // If mcVersion is 1.20.1, look for 1.20.1-x

                const filtered = versions.filter(v => {
                    if (v.startsWith(mcVersion + '-')) return true; // old style
                    // New style: 1.20.4 -> 20.4
                    // Remove "1." from mcVersion?
                    // 1.20.4 -> 20.4
                    const shortMc = mcVersion.replace(/^1\./, ''); // 20.4
                    if (v.startsWith(shortMc + '.')) return true;
                    return false;
                });

                return {
                    success: true,
                    versions: filtered.map(v => ({ version: v, stable: false }))
                };
            }

            return { success: true, versions: [] };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('instance:get-supported-game-versions', async (_, loader) => {
        try {
            if (!loader) return { success: false, error: 'Missing loader argument' };
            const loaderName = loader.toLowerCase();
            const supportedVersions = new Set();

            if (loaderName === 'fabric') {
                const res = await axios.get(`${FABRIC_META}/versions/game`);
                res.data.forEach(v => supportedVersions.add(v.version));
            } else if (loaderName === 'quilt') {
                const res = await axios.get(`${QUILT_META}/versions/game`);
                res.data.forEach(v => supportedVersions.add(v.version));
            } else if (loaderName === 'forge') {
                // Forge "game versions" are implicit in the artifact versions.
                // We fetch the metadata again (cached ideally, but we'll fetch for now)
                // and extract the MC version part.
                const versions = await fetchMavenVersions('https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml');
                versions.forEach(v => {
                    // 1.18.1-39.1.2 -> 1.18.1
                    const dashIndex = v.indexOf('-');
                    if (dashIndex !== -1) {
                        const mcVer = v.substring(0, dashIndex);
                        // Basic validation to ensure it looks like a version
                        if (/^\d+\.\d+(\.\d+)?$/.test(mcVer)) {
                            supportedVersions.add(mcVer);
                        }
                    }
                });
            } else if (loaderName === 'neoforge') {
                const versions = await fetchMavenVersions('https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml');
                if (versions && versions.length > 0) {
                    console.log(`[NeoForge Logic] Raw versions found: ${versions.length}. First 5: ${versions.slice(0, 5).join(', ')}`);
                }

                versions.forEach(v => {
                    // Old: 1.20.1-47.1.3
                    // New: 20.4.123 -> matches 1.20.4
                    if (v.includes('-')) {
                        const dashIndex = v.indexOf('-');
                        const mcVer = v.substring(0, dashIndex);
                        // Strict validation: MC versions must start with "1."
                        // This prevents NeoForge versions like "21.1.1-beta" from being treated as MC versions
                        if (/^1\.\d+(\.\d+)?$/.test(mcVer)) {
                            supportedVersions.add(mcVer);
                        } else {
                            console.log(`[NeoForge Logic] Ignored (bad prefix): ${mcVer} from ${v}`);
                        }
                    } else {
                        // Handle new versioning: 20.4.X -> 1.20.4
                        // 21.0.X -> 1.21
                        const parts = v.split('.');
                        if (parts.length >= 2) {
                            const major = parseInt(parts[0]);
                            const minor = parseInt(parts[1]);
                            if (!isNaN(major) && !isNaN(minor)) {
                                if (major >= 20) {
                                    // 20.1 -> 1.20.1
                                    // 20.4 -> 1.20.4
                                    // 21.0 -> 1.21 ? Or 1.21.0
                                    // Mapping logic: 1.{major}.{minor}
                                    let derivedVersion;
                                    if (minor === 0 && major === 21) derivedVersion = `1.${major}`; // 1.21
                                    else if (minor === 1 && major === 21) derivedVersion = `1.${major}.1`;
                                    else derivedVersion = `1.${major}.${minor}`;

                                    supportedVersions.add(derivedVersion);

                                    // Also manually add 1.21 for 21.x series if not sure
                                    if (major === 21) supportedVersions.add('1.21');
                                    if (major === 20 && minor === 6) supportedVersions.add('1.20.6');
                                }
                            }
                        }
                    }
                });
            }

            // Convert Set to sorted array (descending semver-ish)
            const sorted = Array.from(supportedVersions).sort((a, b) => {
                // specific logic for semver sort if needed, or just let frontend handle it
                // For now, let's reverse sort by string (works mostly for 1.20 vs 1.19)
                return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
            });

            return { success: true, versions: sorted };

        } catch (e) {
            console.error('Error fetching supported game versions:', e);
            return { success: false, error: e.message };
        }
    });



    ipcMain.handle('instance:update', async (_, instanceName, newConfig) => {
        try {
            const configPath = path.join(instancesDir, instanceName, 'instance.json');
            if (await fs.pathExists(configPath)) {
                const current = await fs.readJson(configPath);
                // Merge, but ensure name/created match? Or just trust frontend
                // For now, simple merge
                const updated = { ...current, ...newConfig };
                await fs.writeJson(configPath, updated, { spaces: 4 });
                return { success: true };
            }
            return { success: false, error: 'Instance not found' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('instance:rename', async (_, oldName, newName) => {
        try {
            console.log(`Renaming instance: "${oldName}" -> "${newName}"`);
            console.log(`Instances dir: ${instancesDir}`);

            if (!newName || newName.trim() === '') {
                return { success: false, error: 'New name cannot be empty' };
            }
            const oldPath = path.join(instancesDir, oldName);
            const newPath = path.join(instancesDir, newName);

            console.log(`Old path: ${oldPath}`);
            console.log(`Exists: ${await fs.pathExists(oldPath)}`);

            if (!await fs.pathExists(oldPath)) {
                return { success: false, error: `Instance not found at: ${oldPath}` };
            }
            if (await fs.pathExists(newPath)) {
                return { success: false, error: 'An instance with that name already exists' };
            }

            // Rename the folder
            await fs.rename(oldPath, newPath);

            // Update the instance.json with the new name
            const configPath = path.join(newPath, 'instance.json');
            const config = await fs.readJson(configPath);
            config.name = newName;
            await fs.writeJson(configPath, config, { spaces: 4 });

            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('instance:duplicate', async (_, instanceName) => {
        try {
            const sourcePath = path.join(instancesDir, instanceName);
            if (!await fs.pathExists(sourcePath)) {
                return { success: false, error: 'Instance not found' };
            }

            // Find a unique name
            let newName = `${instanceName} (Copy)`;
            let counter = 2;
            while (await fs.pathExists(path.join(instancesDir, newName))) {
                newName = `${instanceName} (Copy ${counter})`;
                counter++;
            }

            const destPath = path.join(instancesDir, newName);

            // Copy entire folder
            await fs.copy(sourcePath, destPath);

            // Update the instance.json with new name
            const configPath = path.join(destPath, 'instance.json');
            if (await fs.pathExists(configPath)) {
                const config = await fs.readJson(configPath);
                config.name = newName;
                config.created = Date.now();
                config.playtime = 0;
                config.lastPlayed = null;
                await fs.writeJson(configPath, config, { spaces: 4 });
            }

            return { success: true, newName };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('dialog:open-file', async (_, options = {}) => {
        const defaultFilters = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'] }];
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: options.properties || ['openFile'],
            filters: options.filters || defaultFilters
        });
        if (canceled) return null;
        return filePaths[0];
    });

    ipcMain.handle('instance:open-folder', async (_, instanceName) => {
        // Remove redundant require
        // const { shell } = require('electron'); 
        const instancePath = path.join(instancesDir, instanceName);
        if (await fs.pathExists(instancePath)) {
            await shell.openPath(instancePath);
            return { success: true };
        }
        return { success: false, error: 'Instance folder not found' };
    });



    ipcMain.handle('instance:delete', async (_, name) => {
        try {
            console.log(`[Instance:Delete] Request to delete ${name}`);

            // 1. Abort ongoing installation if any
            const task = activeTasks.get(name);
            if (task) {
                console.log(`[Instance:Delete] Aborting installation for ${name}`);
                task.abort();
                activeTasks.delete(name);
            }

            // 2. Kill running instance if any
            // We invoke the launcher:kill handler logic directly or via IPC if mapped, 
            // but since we are in main process, we can't easily call another handler's IPC *handler* directly without a helper.
            // Ideally, launcher.js should export a kill function or we send a message.
            // For now, let's assume the frontend calls launcher:kill BEFORE instance:delete. 
            // BUT, to be safe, we should try to ensure it is stopped. 
            // Since we don't have direct access to launcher's internal map here, we rely on the frontend 
            // OR we could emit an event. 

            // BETTER APPROACH: Wait for a moment to let processes die and file handles release.
            // Windows file locking is aggressive.
            await new Promise(resolve => setTimeout(resolve, 500));

            const dir = path.join(instancesDir, name);
            if (!await fs.pathExists(dir)) {
                return { success: true }; // Already gone
            }

            // 3. Robust Deletion with Retries
            const maxRetries = 5;
            for (let i = 0; i < maxRetries; i++) {
                try {
                    await fs.remove(dir);
                    console.log(`[Instance:Delete] Successfully deleted ${name}`);
                    break;
                } catch (err) {
                    if (i === maxRetries - 1) throw err; // Re-throw on last attempt
                    console.warn(`[Instance:Delete] Attempt ${i + 1} failed, retrying in 1s... (${err.message})`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // Notify frontend to clear any remaining state
            win.webContents.send('instance:status', { instanceName: name, status: 'deleted' });

            return { success: true };
        } catch (e) {
            console.error(`[Instance:Delete] Failed to delete ${name}:`, e);
            return { success: false, error: `Failed to delete instance: ${e.message}` };
        }
    });

    // Mod Management



    ipcMain.handle('instance:get-mods', async (_, instanceName) => {
        try {
            const modsDir = path.join(instancesDir, instanceName, 'mods');
            await fs.ensureDir(modsDir);

            // Mod Cache
            const modCachePath = path.join(appData, 'mod_cache.json');
            let modCache = {};
            try {
                if (await fs.pathExists(modCachePath)) {
                    modCache = await fs.readJson(modCachePath);
                }
            } catch (e) {
                console.error('Failed to load mod cache', e);
            }

            const saveModCache = async () => {
                try {
                    await fs.writeJson(modCachePath, modCache);
                } catch (e) { console.error('Failed to save mod cache', e); }
            };

            const files = await fs.readdir(modsDir);
            const jars = files.filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled') || f.endsWith('.litemod'));

            const modObjects = (await Promise.all(jars.map(async (fileName) => {
                try {
                    const filePath = path.join(modsDir, fileName);
                    const stats = await fs.stat(filePath);
                    const isEnabled = !fileName.endsWith('.disabled');

                    // metadata lookup
                    let title = null;
                    let icon = null;
                    let version = null;

                    const cacheKey = `${fileName}-${stats.size}`;
                    if (modCache[cacheKey] && modCache[cacheKey].projectId) {
                        title = modCache[cacheKey].title;
                        icon = modCache[cacheKey].icon;
                        version = modCache[cacheKey].version;
                    } else {
                        // Lookup Modrinth metadata
                        try {
                            const hash = await calculateSha1(filePath);
                            const res = await axios.get(`https://api.modrinth.com/v2/version_file/${hash}`, {
                                headers: { 'User-Agent': 'Client/MCLC/1.0 (fernsehheft@pluginhub.de)' },
                                timeout: 3000
                            });
                            const versionData = res.data;

                            if (versionData && versionData.project_id) {
                                // Get project for icon
                                const projectRes = await axios.get(`https://api.modrinth.com/v2/project/${versionData.project_id}`, {
                                    headers: { 'User-Agent': 'Client/MCLC/1.0 (fernsehheft@pluginhub.de)' },
                                    timeout: 3000
                                });
                                const projectData = projectRes.data;

                                title = projectData.title;
                                icon = projectData.icon_url;
                                version = versionData.version_number;
                                const projectId = projectData.id;
                                const versionId = versionData.id;

                                // Update cache object (we'll save it after the loop)
                                modCache[cacheKey] = { title, icon, version, hash, projectId, versionId };
                            }
                        } catch (apiErr) {
                            // Silently fail API lookups
                        }
                    }

                    return {
                        name: fileName,
                        path: filePath,
                        size: stats.size,
                        enabled: isEnabled,
                        title: title || fileName,
                        icon: icon,
                        version: version,
                        projectId: modCache[cacheKey]?.projectId,
                        versionId: modCache[cacheKey]?.versionId
                    };
                } catch (e) {
                    console.error(`Error processing mod ${fileName}:`, e);
                    return null;
                }
            }))).filter(m => m !== null);

            // Save cache once after processing everything
            await fs.writeJson(modCachePath, modCache).catch(() => { });

            return { success: true, mods: modObjects };
        } catch (e) {
            console.error('Failed to get mods:', e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('instance:toggle-mod', async (_, instanceName, modFileName) => {
        try {
            const modsDir = path.join(instancesDir, instanceName, 'mods');
            const oldPath = path.join(modsDir, modFileName);

            let newName;
            if (modFileName.endsWith('.disabled')) {
                newName = modFileName.replace('.disabled', '');
            } else {
                newName = modFileName + '.disabled';
            }

            await fs.rename(oldPath, path.join(modsDir, newName));
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('instance:delete-mod', async (_, instanceName, modFileName, projectType = 'mod') => {
        try {
            let folder = 'mods';
            if (projectType === 'resourcepack') folder = 'resourcepacks';
            if (projectType === 'shader') folder = 'shaderpacks';

            const contentDir = path.join(instancesDir, instanceName, folder);
            const modPath = path.join(contentDir, modFileName);

            console.log(`[Instance:Delete] Request: ${instanceName} / ${folder} / ${modFileName}`);
            console.log(`[Instance:Delete] Target Path: ${modPath}`);

            if (!await fs.pathExists(modPath)) {
                console.warn(`[Instance:Delete] Path does not exist: ${modPath}`);
                return { success: true }; // Already "deleted"
            }

            await fs.remove(modPath);

            // Verify deletion
            if (await fs.pathExists(modPath)) {
                console.error(`[Instance:Delete] FAILED: File still exists at ${modPath}`);
                return { success: false, error: 'File could not be removed (is it locked?)' };
            }

            console.log(`[Instance:Delete] SUCCESS: Deleted ${modPath}`);
            return { success: true };
        } catch (e) {
            console.error(`[Instance:Delete] Error deleting ${modFileName}:`, e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('instance:check-updates', async (_, instanceName, contentList) => {
        // contentList: [{ projectId: string, versionId: string, type: 'mod' | 'resourcepack' }]
        try {
            const configPath = path.join(instancesDir, instanceName, 'instance.json');
            const config = await fs.readJson(configPath);
            const mcVersion = config.version;
            const loader = config.loader ? config.loader.toLowerCase() : 'vanilla';

            const results = await Promise.all(contentList.map(async (item) => {
                if (!item.projectId) return { ...item, hasUpdate: false };

                try {
                    // Fetch versions filtered by MC version and loader
                    const loaders = (item.type === 'resourcepack' || item.type === 'shader') ? [] : [loader];
                    const params = {
                        loaders: JSON.stringify(loaders),
                        game_versions: JSON.stringify([mcVersion])
                    };

                    const response = await axios.get(`https://api.modrinth.com/v2/project/${item.projectId}/version`, {
                        params,
                        headers: { 'User-Agent': 'Client/MCLC/1.0 (fernsehheft@pluginhub.de)' },
                        timeout: 5000
                    });

                    const versions = response.data;
                    if (versions.length > 0) {
                        const latest = versions[0];
                        if (latest.id !== item.versionId) {
                            return {
                                ...item,
                                hasUpdate: true,
                                newVersionId: latest.id,
                                newVersionNumber: latest.version_number,
                                downloadUrl: latest.files.find(f => f.primary)?.url || latest.files[0]?.url,
                                filename: latest.files.find(f => f.primary)?.filename || latest.files[0]?.filename
                            };
                        }
                    }
                } catch (e) {
                    console.error(`Failed to check update for ${item.projectId}:`, e.message);
                }
                return { ...item, hasUpdate: false };
            }));

            return { success: true, updates: results.filter(r => r.hasUpdate) };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });


    // Export instance to custom .mcpack format (zip with JSON manifest)
    ipcMain.handle('instance:export', async (_, instanceName) => {
        try {
            const instancePath = path.join(instancesDir, instanceName);
            if (!await fs.pathExists(instancePath)) {
                return { success: false, error: 'Instance not found' };
            }

            // Show save dialog
            const { filePath } = await dialog.showSaveDialog({
                title: 'Export Instance',
                defaultPath: `${instanceName}.mcpack`,
                filters: [{ name: 'Modpack', extensions: ['mcpack'] }]
            });

            if (!filePath) return { success: false, error: 'Cancelled' };

            // Create zip archive
            const archiver = require('archiver');
            const output = fs.createWriteStream(filePath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            archive.pipe(output);

            // Add instance.json
            archive.file(path.join(instancePath, 'instance.json'), { name: 'instance.json' });

            // Add mods folder if exists
            const modsPath = path.join(instancePath, 'mods');
            if (await fs.pathExists(modsPath)) {
                archive.directory(modsPath, 'mods');
            }

            // Add config folder if exists
            const configPath = path.join(instancePath, 'config');
            if (await fs.pathExists(configPath)) {
                archive.directory(configPath, 'config');
            }

            await archive.finalize();

            return new Promise((resolve) => {
                output.on('close', () => resolve({ success: true, path: filePath }));
                output.on('error', (err) => resolve({ success: false, error: err.message }));
            });
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // Shared Modrinth Modpack Installer Logic
    const installMrPack = async (packPath, nameOverride = null) => {
        try {
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(packPath);

            const indexEntry = zip.getEntry('modrinth.index.json');
            if (!indexEntry) throw new Error('Invalid mrpack: missing modrinth.index.json');

            const index = JSON.parse(indexEntry.getData().toString('utf8'));
            let instanceName = nameOverride || index.name;

            // Handle name collisions
            let targetDir = path.join(instancesDir, instanceName);
            let counter = 1;
            while (await fs.pathExists(targetDir)) {
                instanceName = `${nameOverride || index.name} (${counter++})`;
                targetDir = path.join(instancesDir, instanceName);
            }

            await fs.ensureDir(targetDir);

            // Create initial instance.json
            const mcVersion = index.dependencies.minecraft;
            let loaderType = 'Vanilla';
            let loaderVersion = '';

            if (index.dependencies['fabric-loader']) {
                loaderType = 'Fabric';
                loaderVersion = index.dependencies['fabric-loader'];
            } else if (index.dependencies['quilt-loader']) {
                loaderType = 'Quilt';
                loaderVersion = index.dependencies['quilt-loader'];
            } else if (index.dependencies['forge']) {
                loaderType = 'Forge';
                loaderVersion = index.dependencies['forge'];
            } else if (index.dependencies['neoforge']) {
                loaderType = 'NeoForge';
                loaderVersion = index.dependencies['neoforge'];
            }

            const instanceConfig = {
                name: instanceName,
                version: mcVersion,
                loader: loaderType,
                loaderVersion: loaderVersion,
                icon: DEFAULT_ICON,
                status: 'installing',
                created: Date.now()
            };

            await fs.writeJson(path.join(targetDir, 'instance.json'), instanceConfig, { spaces: 4 });

            // Start background download & extraction
            (async () => {
                try {
                    const sendProgress = (progress, status) => {
                        if (win && win.webContents) {
                            win.webContents.send('install:progress', { instanceName, progress, status });
                        }
                    };

                    sendProgress(5, 'Extracting overrides...');
                    // Extract overrides
                    const entries = zip.getEntries();
                    for (const entry of entries) {
                        if (entry.entryName.startsWith('overrides/')) {
                            const relPath = entry.entryName.replace('overrides/', '');
                            if (relPath) {
                                const dest = path.join(targetDir, relPath);
                                if (entry.isDirectory) {
                                    await fs.ensureDir(dest);
                                } else {
                                    await fs.ensureDir(path.dirname(dest));
                                    await fs.writeFile(dest, entry.getData());
                                }
                            }
                        }
                    }

                    sendProgress(20, `Downloading ${index.files.length} files...`);

                    const totalFiles = index.files.length;
                    let downloaded = 0;

                    // Download in chunks of 5
                    const pLimit = require('p-limit'); // Check if p-limit is available, else manual
                    // Manual chunking if p-limit is missing
                    const chunks = [];
                    for (let i = 0; i < index.files.length; i += 5) {
                        chunks.push(index.files.slice(i, i + 5));
                    }

                    for (const chunk of chunks) {
                        await Promise.all(chunk.map(async (file) => {
                            const dest = path.join(targetDir, file.path);
                            await fs.ensureDir(path.dirname(dest));
                            await downloadFile(file.downloads[0], dest);
                            downloaded++;
                            const progress = 20 + Math.round((downloaded / totalFiles) * 60);
                            sendProgress(progress, `Downloading: ${path.basename(file.path)} (${downloaded}/${totalFiles})`);
                        }));
                    }

                    sendProgress(90, 'Finalizing installation...');

                    // Trigger standard install to ensure base game & loader files are present
                    // We call startBackgroundInstall which will handle the rest
                    await startBackgroundInstall(instanceName, instanceConfig, false, false);

                } catch (err) {
                    console.error('[Import:MrPack] Error:', err);
                    if (win && win.webContents) {
                        win.webContents.send('instance:status', { instanceName, status: 'error', error: err.message });
                    }
                }
            })();

            return { success: true, instanceName };
        } catch (e) {
            throw e;
        }
    };

    // Import instance from .mrpack file (Modrinth modpack format)
    ipcMain.handle('instance:import-mrpack', async (_) => {
        try {
            const { filePaths } = await dialog.showOpenDialog({
                title: 'Import Modrinth Modpack',
                filters: [{ name: 'Modrinth Modpack', extensions: ['mrpack'] }],
                properties: ['openFile']
            });

            if (!filePaths || filePaths.length === 0) return { success: false, error: 'Cancelled' };

            const packPath = filePaths[0];
            return await installMrPack(packPath);
        } catch (e) {
            console.error('[Import:MrPack] Dialog Error:', e);
            return { success: false, error: e.message };
        }
    });

    // Install Modpack from URL (Modrinth App/Direct)
    ipcMain.handle('instance:install-modpack', async (_, url, name) => {
        try {
            console.log(`[Modpack:Install] URL: ${url}, Name: ${name}`);
            const tempPath = path.join(os.tmpdir(), `mclc-modpack-${Date.now()}.mrpack`);

            // Send initial progress if possible, using a dummy name or the provided one
            if (win && win.webContents) {
                win.webContents.send('install:progress', { instanceName: name, progress: 1, status: 'Downloading Modpack...' });
            }

            await downloadFile(url, tempPath);
            console.log(`[Modpack:Install] Downloaded to ${tempPath}`);

            const result = await installMrPack(tempPath, name);

            // Cleanup temp file
            // Note: installMrPack reads it synchronously mostly but startBackgroundInstall is async. 
            // The zip reading happens early in installMrPack so we should be safe to delete after it returns?
            // installMrPack returns { success: true, instanceName } AFTER starting background work.
            // The zip object in installMrPack is not persistent.
            await fs.remove(tempPath);

            return result;
        } catch (e) {
            console.error('[Modpack:Install] Error:', e);
            return { success: false, error: e.message };
        }
    });

    // Import instance from custom .mcpack format
    ipcMain.handle('instance:import', async (_) => {
        try {
            // Show open dialog
            const { filePaths } = await dialog.showOpenDialog({
                title: 'Import Instance',
                filters: [{ name: 'Modpack', extensions: ['mcpack', 'zip'] }],
                properties: ['openFile']
            });

            if (!filePaths || filePaths.length === 0) {
                return { success: false, error: 'Cancelled' };
            }

            const packPath = filePaths[0];
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(packPath);

            // Read instance.json from zip
            const instanceJsonEntry = zip.getEntry('instance.json');
            if (!instanceJsonEntry) {
                return { success: false, error: 'Invalid modpack: missing instance.json' };
            }

            const instanceConfig = JSON.parse(instanceJsonEntry.getData().toString('utf8'));
            let instanceName = instanceConfig.name || path.basename(packPath, path.extname(packPath));

            // Check if name exists, append number if so
            let targetDir = path.join(instancesDir, instanceName);
            let counter = 1;
            while (await fs.pathExists(targetDir)) {
                instanceName = `${instanceConfig.name || 'Imported'} (${counter++})`;
                targetDir = path.join(instancesDir, instanceName);
            }

            // Extract to instance directory
            await fs.ensureDir(targetDir);
            zip.extractAllTo(targetDir, true);

            // Update instance.json with new name
            instanceConfig.name = instanceName;
            instanceConfig.imported = Date.now();
            await fs.writeJson(path.join(targetDir, 'instance.json'), instanceConfig, { spaces: 4 });

            return { success: true, instanceName };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('instance:migrate', async (_, instanceName, newConfig) => {
        try {
            console.log(`[Instance:Migrate] Starting migration for ${instanceName}`);
            const configPath = path.join(instancesDir, instanceName, 'instance.json');
            if (!await fs.pathExists(configPath)) throw new Error('Instance not found');

            const currentConfig = await fs.readJson(configPath);
            const finalConfig = { ...currentConfig, ...newConfig, status: 'installing' };

            // Save initial change to status
            await fs.writeJson(configPath, finalConfig, { spaces: 4 });

            // Start background migration flow
            startBackgroundInstall(instanceName, finalConfig, false, true);

            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // Install a local file (JAR or ZIP) as a mod or resource pack
    ipcMain.handle('instance:install-local-mod', async (_, instanceName, filePath, projectType = 'mod') => {
        try {
            const folder = projectType === 'resourcepack' ? 'resourcepacks' : 'mods';
            const destDir = path.join(instancesDir, instanceName, folder);
            await fs.ensureDir(destDir);

            const fileName = path.basename(filePath);
            const destPath = path.join(destDir, fileName);

            // Copy file to instance folder
            await fs.copy(filePath, destPath);

            console.log(`[Content:InstallLocal] Copied ${projectType}: ${fileName} to ${instanceName}`);
            return { success: true };
        } catch (e) {
            console.error(`[Content:InstallLocal] Error adding content to ${instanceName}:`, e);
            return { success: false, error: e.message };
        }
    });



    ipcMain.handle('instance:update-file', async (_, data) => {
        console.log(`Updating file for ${data.instanceName}: ${data.oldFileName} -> ${data.newFileName}`);
        try {
            const instancePath = path.join(instancesDir, data.instanceName);
            let subDir = 'mods';
            if (data.projectType === 'resourcepack') subDir = 'resourcepacks';
            if (data.projectType === 'shader') subDir = 'shaderpacks';

            const targetDir = path.join(instancePath, subDir);

            const oldPath = path.join(targetDir, data.oldFileName);
            if (await fs.pathExists(oldPath)) {
                await fs.remove(oldPath);
            }

            const newPath = path.join(targetDir, data.newFileName);
            await downloadFile(data.url, newPath);

            const modCachePath = path.join(appData, 'mod_cache.json');


            return { success: true };
        } catch (e) {
            console.error('Update failed:', e);
            return { success: false, error: e.message };
        }
    });

    console.log('[Instances] Instance handlers registered.');
    return ipcMain;
};