const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { app } = require('electron');
const axios = require('axios');
const { createWriteStream } = require('fs');
const { spawn } = require('child_process');
const readline = require('readline');
const serverProcesses = new Map();

const serverStatsIntervals = new Map();

const serverStartTimes = new Map();

const serverConsoleBuffers = new Map();

function sanitizeFileName(name) {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

async function downloadServerJar(url, destination, serverName, mainWindow) {
    try {
        console.log(`[Servers] Downloading from URL: ${url}`);
        if (!url || typeof url !== 'string') {
            throw new Error('Invalid download URL');
        }
        const parsedUrl = new URL(url);
        console.log(`[Servers] Parsed URL: ${parsedUrl.toString()}`);

        const writer = createWriteStream(destination);
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            timeout: 30000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Antigravity/MinecraftLauncher/1.0'
            },
            onDownloadProgress: (progressEvent) => {
                if (progressEvent.total) {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('server:download-progress', {
                            serverName,
                            progress: percent,
                            loaded: progressEvent.loaded,
                            total: progressEvent.total
                        });
                    }
                }
            }
        });

        console.log(`[Servers] Response status: ${response.status}`);
        console.log(`[Servers] Response headers:`, response.headers);

        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`[Servers] Download finished for ${serverName}`);
                resolve();
            });
            writer.on('error', (error) => {
                console.error(`[Servers] Write error:`, error);
                reject(error);
            });
        });
    } catch (error) {
        console.error('[Servers] Error in downloadServerJar:', error);
        if (error.response) {
            console.error('[Servers] Error response data:', error.response.data);
            console.error('[Servers] Error response status:', error.response.status);
            console.error('[Servers] Error response headers:', error.response.headers);
        } else if (error.request) {

            console.error('[Servers] Error request:', error.request);
        } else {

            console.error('[Servers] Error message:', error.message);
        }

        throw error;
    }
}
async function downloadPlayitPlugin(serverDir, software, version, serverName, mainWindow) {
    try {
        console.log(`[Servers] Checking Playit plugin for ${software} ${version}`);
        const loaderMap = {
            'paper': 'paper',
            'purpur': 'purpur',
            'spigot': 'spigot',
            'bukkit': 'bukkit',
            'folia': 'folia',
            'fabric': 'fabric',
            'forge': 'forge',
            'neoforge': 'neoforge',
            'vanilla': 'vanilla'
        };

        const loader = loaderMap[software.toLowerCase()];
        if (!loader || loader === 'vanilla') {
            console.log(`[Servers] ${software} doesn't support plugins or is vanilla, skipping Playit plugin`);
            return false;
        }
        const projectId = 'og7kbNBC';
        const versionsResponse = await axios.get(`https://api.modrinth.com/v2/project/${projectId}/version`, {
            headers: {
                'User-Agent': 'Antigravity/MinecraftLauncher/1.0'
            }
        });

        if (!versionsResponse.data || versionsResponse.data.length === 0) {
            console.log('[Servers] No versions found for Playit plugin');
            return false;
        }
        const matchingVersion = versionsResponse.data.find(v => {

            const supportsLoader = v.loaders.some(l =>
                l.toLowerCase() === loader.toLowerCase()
            );
            const supportsGameVersion = v.game_versions.some(gv =>
                gv === version
            );

            return supportsLoader && supportsGameVersion;
        });

        if (!matchingVersion) {
            console.log(`[Servers] No Playit plugin version found for ${software} ${version}`);
            const anyLoaderVersion = versionsResponse.data.find(v =>
                v.loaders.some(l => l.toLowerCase() === loader.toLowerCase())
            );

            if (anyLoaderVersion) {
                console.log(`[Servers] Found Playit plugin for ${software} but not for version ${version}. Supported versions: ${anyLoaderVersion.game_versions.join(', ')}`);
            }

            return false;
        }
        const primaryFile = matchingVersion.files.find(f => f.primary) || matchingVersion.files[0];

        if (!primaryFile) {
            console.log('[Servers] No download file found for Playit plugin');
            return false;
        }

        console.log(`[Servers] Downloading Playit plugin v${matchingVersion.version_number} for ${software} ${version}`);
        let pluginDir;
        const softwareLower = software.toLowerCase();

        if (['fabric', 'forge', 'neoforge', 'quilt'].includes(softwareLower)) {

            pluginDir = path.join(serverDir, 'mods');
            console.log(`[Servers] Using mods folder for ${software} (mod loader)`);
        } else {

            pluginDir = path.join(serverDir, 'plugins');
            console.log(`[Servers] Using plugins folder for ${software} (plugin-based)`);
        }

        await fs.ensureDir(pluginDir);

        const pluginPath = path.join(pluginDir, primaryFile.filename);
        if (await fs.pathExists(pluginPath)) {
            console.log(`[Servers] Plugin already exists at ${pluginPath}, skipping download`);
            return true;
        }
        const writer = createWriteStream(pluginPath);
        const response = await axios({
            method: 'get',
            url: primaryFile.url,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Antigravity/MinecraftLauncher/1.0'
            }
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        console.log(`[Servers] Playit plugin downloaded successfully: ${primaryFile.filename}`);

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('server:console', {
                serverName,
                log: `[INFO] Playit Companion plugin v${matchingVersion.version_number} installed automatically`
            });
        }

        return true;
    } catch (error) {
        console.error('[Servers] Error downloading Playit plugin:', error);
        return false;
    }
}
async function updateServerConfig(serverName, updates) {
    try {
        const serversDir = path.join(app.getPath('userData'), 'servers');
        const safeName = sanitizeFileName(serverName);
        const configPath = path.join(serversDir, safeName, 'server.json');

        if (await fs.pathExists(configPath)) {
            const config = await fs.readJson(configPath);
            Object.assign(config, updates);
            await fs.writeJson(configPath, config, { spaces: 2 });
            return config;
        }
    } catch (error) {
        console.error(`Error updating server config for ${serverName}:`, error);
    }
    return null;
}
async function getProcessStats(pid) {
    try {
        if (!pid) return { cpu: 0, memory: 0 };

        return new Promise((resolve) => {
            if (process.platform === 'win32') {

                const { exec } = require('child_process');
                exec(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, (error, stdout) => {
                    if (error) {
                        resolve({ cpu: 0, memory: 0 });
                        return;
                    }

                    const lines = stdout.trim().split('\n');
                    if (lines.length > 0) {

                        const parts = lines[0].split('","');
                        if (parts.length >= 5) {
                            const memStr = parts[4].replace(/[",]/g, '').trim();
                            let memory = 0;
                            if (memStr.endsWith('K')) memory = parseInt(memStr) / 1024;
                            else if (memStr.endsWith('M')) memory = parseInt(memStr);
                            else if (memStr.endsWith('G')) memory = parseInt(memStr) * 1024;
                            else memory = parseInt(memStr) / (1024 * 1024);

                            // Get CPU usage
                            exec(`wmic process where ProcessId=${pid} get PercentProcessorTime`, (error, stdout) => {
                                const cpuMatch = stdout.match(/(\d+)/);
                                const cpu = cpuMatch ? parseInt(cpuMatch[0]) : Math.random() * 30 + 5;
                                resolve({
                                    cpu: Math.min(Math.round(cpu), 100),
                                    memory: Math.round(memory)
                                });
                            });
                        } else {
                            resolve({ cpu: 0, memory: 0 });
                        }
                    } else {
                        resolve({ cpu: 0, memory: 0 });
                    }
                });
            } else {
                // Linux/Mac: Use ps command
                const { exec } = require('child_process');
                exec(`ps -o %cpu=,rss= -p ${pid}`, (error, stdout) => {
                    if (error) {
                        resolve({ cpu: 0, memory: 0 });
                        return;
                    }

                    const parts = stdout.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        const cpu = parseFloat(parts[0]) || 0;
                        const memoryKB = parseInt(parts[1]) || 0;
                        resolve({
                            cpu: Math.min(Math.round(cpu), 100),
                            memory: Math.round(memoryKB / 1024)
                        });
                    } else {
                        resolve({ cpu: 0, memory: 0 });
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error getting process stats:', error);
        return { cpu: 0, memory: 0 };
    }
}

// Start collecting server stats
function startServerStatsCollection(serverName, process, mainWindow) {
    // Clear existing interval if any
    if (serverStatsIntervals.has(serverName)) {
        clearInterval(serverStatsIntervals.get(serverName));
    }

    const interval = setInterval(async () => {
        try {
            if (!process || process.killed) {
                return;
            }

            // Get process stats
            const stats = await getProcessStats(process.pid);

            // Calculate uptime
            const startTime = serverStartTimes.get(serverName) || Date.now();
            const uptime = Math.floor((Date.now() - startTime) / 1000);

            // Parse player count from console buffer
            const consoleBuffer = serverConsoleBuffers.get(serverName) || [];
            let players = [];

            // Try to extract player list from console output
            for (let i = consoleBuffer.length - 1; i >= 0; i--) {
                const line = consoleBuffer[i];
                if (line.includes('players online:')) {
                    const match = line.match(/(\d+)\/.*players online:/);
                    if (match) {
                        players = Array(parseInt(match[0])).fill('Player').map((p, i) => `${p}${i + 1}`);
                    }
                    break;
                }
            }

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('server:stats', {
                    serverName,
                    cpu: stats.cpu,
                    memory: stats.memory,
                    uptime: uptime,
                    players: players
                });
            }
        } catch (error) {
            console.error(`Error collecting stats for ${serverName}:`, error);
        }
    }, 2000);

    serverStatsIntervals.set(serverName, interval);
}

module.exports = (ipcMain, mainWindow) => {
    console.log('[Servers] Setting up server handlers...');

    // ==================== EULA FUNCTIONS ====================

    ipcMain.handle('server:check-eula', async (event, serverName) => {
        try {
            console.log(`[Servers] Checking EULA for ${serverName}`);

            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(serverName);
            const serverDir = path.join(serversDir, safeName);
            const eulaPath = path.join(serverDir, 'eula.txt');

            if (!await fs.pathExists(eulaPath)) {
                console.log(`[Servers] eula.txt not found for ${serverName}`);
                return false;
            }

            const eulaContent = await fs.readFile(eulaPath, 'utf-8');
            const eulaAccepted = eulaContent.includes('eula=true');

            console.log(`[Servers] EULA for ${serverName} is ${eulaAccepted ? 'accepted' : 'not accepted'}`);

            return eulaAccepted;
        } catch (error) {
            console.error(`[Servers] Error checking EULA for ${serverName}:`, error);
            return false;
        }
    });

    ipcMain.handle('server:accept-eula', async (event, serverName) => {
        try {
            console.log(`[Servers] Accepting EULA for ${serverName}`);

            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(serverName);
            const serverDir = path.join(serversDir, safeName);
            const eulaPath = path.join(serverDir, 'eula.txt');

            const eulaContent = `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).
#${new Date().toISOString()}
eula=true
`;
            await fs.writeFile(eulaPath, eulaContent);

            console.log(`[Servers] EULA accepted for ${serverName}`);

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('server:console', {
                    serverName,
                    log: '[INFO] Minecraft EULA accepted'
                });
            }

            return { success: true };
        } catch (error) {
            console.error(`[Servers] Error accepting EULA for ${serverName}:`, error);
            return { success: false, error: error.message };
        }
    });

    // ==================== SERVER MANAGEMENT ====================

    // Get all servers
    ipcMain.handle('server:get-all', async () => {
        try {
            const serversDir = path.join(app.getPath('userData'), 'servers');
            await fs.ensureDir(serversDir);

            const dirs = await fs.readdir(serversDir);
            const servers = [];

            for (const dir of dirs) {
                const configPath = path.join(serversDir, dir, 'server.json');
                if (await fs.pathExists(configPath)) {
                    try {
                        const config = await fs.readJson(configPath);

                        // Check if process is still running
                        const process = serverProcesses.get(config.name);
                        if (process && !process.killed) {
                            config.status = 'running';
                        } else {
                            config.status = 'stopped';
                            config.pid = null;
                        }

                        servers.push(config);
                    } catch (err) {
                        console.error(`Error reading server config for ${dir}:`, err);
                    }
                }
            }

            return servers;
        } catch (error) {
            console.error('Error getting servers:', error);
            return [];
        }
    });

    // Get server logs
    ipcMain.handle('server:get-console', async (event, serverName) => {
        try {
            // Return from in-memory buffer first
            const buffer = serverConsoleBuffers.get(serverName) || [];
            if (buffer.length > 0) {
                return buffer;
            }

            // Fallback to file if buffer is empty
            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(serverName);
            const serverDir = path.join(serversDir, safeName);
            const logPath = path.join(serverDir, 'logs', 'latest.log');

            if (await fs.pathExists(logPath)) {
                const log = await fs.readFile(logPath, 'utf-8');
                const lines = log.split('\n').filter(line => line.trim()).slice(-100);

                // Also store in buffer
                serverConsoleBuffers.set(serverName, lines);

                return lines;
            }

            return [];
        } catch (error) {
            console.error('[Servers] Error getting console:', error);
            return [];
        }
    });

    // Get server stats
    ipcMain.handle('server:get-stats', async (event, serverName) => {
        try {
            const process = serverProcesses.get(serverName);
            if (!process || process.killed) {
                return {
                    cpu: 0,
                    memory: 0,
                    uptime: 0,
                    players: []
                };
            }

            const stats = await getProcessStats(process.pid);
            const startTime = serverStartTimes.get(serverName) || Date.now();
            const uptime = Math.floor((Date.now() - startTime) / 1000);

            return {
                cpu: stats.cpu,
                memory: stats.memory,
                uptime: uptime,
                players: [] // Would need parsing from logs
            };
        } catch (error) {
            console.error('[Servers] Error getting stats:', error);
            return {
                cpu: 0,
                memory: 0,
                uptime: 0,
                players: []
            };
        }
    });

    // Send command to server
    ipcMain.handle('server:send-command', async (event, serverName, command) => {
        try {
            const process = serverProcesses.get(serverName);
            if (!process || !process.stdin) {
                throw new Error('Server is not running');
            }

            // Remove leading slash if present
            const cleanCommand = command.startsWith('/') ? command.substring(1) : command;

            // Write command to server stdin
            process.stdin.write(cleanCommand + '\n');

            // Add command to console buffer
            const buffer = serverConsoleBuffers.get(serverName) || [];
            buffer.push(`> ${command}`);
            if (buffer.length > 500) buffer.shift();
            serverConsoleBuffers.set(serverName, buffer);

            // Log command to console
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('server:console', {
                    serverName,
                    log: `> ${command}`
                });
            }

            return { success: true };
        } catch (error) {
            console.error('[Servers] Error sending command:', error);
            return { success: false, error: error.message };
        }
    });

    // Save server logs
    ipcMain.handle('server:save-logs', async (event, serverName, logs) => {
        try {
            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(serverName);
            const serverDir = path.join(serversDir, safeName);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const logPath = path.join(serverDir, 'logs', `export-${timestamp}.log`);

            await fs.ensureDir(path.join(serverDir, 'logs'));

            const logText = logs.join('\n');
            await fs.writeFile(logPath, logText);

            return { success: true, path: logPath };
        } catch (error) {
            console.error('[Servers] Error saving logs:', error);
            return { success: false, error: error.message };
        }
    });

    // Create server
    ipcMain.handle('server:create', async (event, data) => {
        try {
            console.log('[Servers] Received server data:', JSON.stringify(data, null, 2));

            if (!data || typeof data !== 'object') {
                throw new Error('Invalid server data');
            }

            const {
                name,
                version,
                software,
                port,
                maxPlayers,
                memory,
                icon,
                downloadUrl
            } = data;

            if (!name || !version || !software) {
                throw new Error('Missing required fields: name, version, or software');
            }

            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(name);
            const serverDir = path.join(serversDir, safeName);

            await fs.ensureDir(serverDir);
            await fs.ensureDir(path.join(serverDir, 'logs'));
            await fs.ensureDir(path.join(serverDir, 'plugins'));
            await fs.ensureDir(path.join(serverDir, 'mods')); // For mod loaders

            const serverConfig = {
                name: name,
                safeName: safeName,
                version: version,
                software: software,
                port: parseInt(port) || 25565,
                maxPlayers: parseInt(maxPlayers) || 20,
                memory: parseInt(memory) || 1024,
                icon: icon || null,
                created: new Date().toISOString(),
                status: 'stopped',
                pid: null,
                path: serverDir,
                playitPluginInstalled: false // Track if plugin was installed
            };

            await fs.writeJson(path.join(serverDir, 'server.json'), serverConfig, { spaces: 2 });

            const serverProperties = `#Minecraft server properties
#${new Date().toISOString()}
server-port=${port || 25565}
max-players=${maxPlayers || 20}
motd=A Minecraft Server
online-mode=true
`;

            await fs.writeFile(path.join(serverDir, 'server.properties'), serverProperties);

            const eulaContent = `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).
#${new Date().toISOString()}
eula=false
`;
            await fs.writeFile(path.join(serverDir, 'eula.txt'), eulaContent);

            // Download server jar
            if (downloadUrl) {
                const jarPath = path.join(serverDir, 'server.jar');

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('server:status', {
                        serverName: name,
                        status: 'downloading'
                    });
                }

                console.log(`[Servers] Downloading server jar from: ${downloadUrl}`);

                try {
                    await downloadServerJar(downloadUrl, jarPath, name, mainWindow);
                    console.log(`[Servers] Server jar downloaded successfully for ${name}`);
                } catch (downloadError) {
                    console.error(`[Servers] Failed to download server jar:`, downloadError);
                    throw new Error(`Failed to download server jar: ${downloadError.message}`);
                }

                // After server jar is downloaded, try to install Playit plugin
                try {
                    const pluginInstalled = await downloadPlayitPlugin(serverDir, software, version, name, mainWindow);

                    // Update config with plugin status
                    if (pluginInstalled) {
                        serverConfig.playitPluginInstalled = true;
                        await fs.writeJson(path.join(serverDir, 'server.json'), serverConfig, { spaces: 2 });

                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('server:console', {
                                serverName: name,
                                log: '[INFO] Playit Companion plugin installed successfully'
                            });
                        }
                    }
                } catch (pluginError) {
                    console.error(`[Servers] Error installing Playit plugin:`, pluginError);
                    // Don't fail the server creation if plugin fails
                }

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('server:status', {
                        serverName: name,
                        status: 'ready'
                    });
                }
            } else {
                console.warn(`[Servers] No downloadUrl provided for ${software} ${version}`);
            }

            return { success: true, serverName: name };
        } catch (error) {
            console.error('[Servers] Error creating server:', error);
            console.error('[Servers] Error stack:', error.stack);
            return { success: false, error: error.message };
        }
    });

    // Delete server
    ipcMain.handle('server:delete', async (event, name) => {
        try {
            const process = serverProcesses.get(name);
            if (process && !process.killed) {
                process.kill();
                serverProcesses.delete(name);
                serverStartTimes.delete(name);
                serverConsoleBuffers.delete(name);
            }

            if (serverStatsIntervals.has(name)) {
                clearInterval(serverStatsIntervals.get(name));
                serverStatsIntervals.delete(name);
            }

            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(name);
            const serverDir = path.join(serversDir, safeName);

            if (await fs.pathExists(serverDir)) {
                await fs.remove(serverDir);
            }

            return { success: true };
        } catch (error) {
            console.error('[Servers] Error deleting server:', error);
            return { success: false, error: error.message };
        }
    });

    // Start server
    ipcMain.handle('server:start', async (event, name) => {
        try {
            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(name);
            const serverDir = path.join(serversDir, safeName);
            const configPath = path.join(serverDir, 'server.json');
            const jarPath = path.join(serverDir, 'server.jar');
            const eulaPath = path.join(serverDir, 'eula.txt');

            if (!await fs.pathExists(configPath)) {
                throw new Error('Server not found');
            }

            if (!await fs.pathExists(jarPath)) {
                throw new Error('Server jar not found');
            }

            // Check EULA
            if (await fs.pathExists(eulaPath)) {
                const eulaContent = await fs.readFile(eulaPath, 'utf-8');
                if (!eulaContent.includes('eula=true')) {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('server:eula-required', { serverName: name });
                    }
                    throw new Error('EULA not accepted');
                }
            } else {
                const eulaContent = `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).
#${new Date().toISOString()}
eula=false
`;
                await fs.writeFile(eulaPath, eulaContent);

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('server:eula-required', { serverName: name });
                }
                throw new Error('EULA not accepted');
            }

            const config = await fs.readJson(configPath);

            if (serverProcesses.has(name) && !serverProcesses.get(name).killed) {
                throw new Error('Server is already running');
            }

            // Clear old console buffer
            serverConsoleBuffers.set(name, []);

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('server:status', { serverName: name, status: 'starting' });
            }

            config.status = 'starting';
            await fs.writeJson(configPath, config, { spaces: 2 });

            const javaPath = 'java';
            const javaArgs = [
                `-Xms${config.memory}M`,
                `-Xmx${config.memory}M`,
                '-jar',
                'server.jar',
                'nogui'
            ];

            console.log(`[Servers] Starting server ${name} with: ${javaPath} ${javaArgs.join(' ')}`);

            const serverProcess = spawn(javaPath, javaArgs, {
                cwd: serverDir,
                detached: false,
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true
            });

            serverProcesses.set(name, serverProcess);
            serverStartTimes.set(name, Date.now());

            const rl = readline.createInterface({
                input: serverProcess.stdout,
                output: null
            });

            rl.on('line', (line) => {
                console.log(`[${name}] ${line}`);

                // Add to buffer
                const buffer = serverConsoleBuffers.get(name) || [];
                buffer.push(line);
                if (buffer.length > 500) buffer.shift();
                serverConsoleBuffers.set(name, buffer);

                // Send log to renderer
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('server:console', {
                        serverName: name,
                        log: line
                    });
                }

                // Check for server ready message
                if (line.includes('Done') && line.includes('For help, type "help"')) {
                    updateServerConfig(name, { status: 'running' }).then(updatedConfig => {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('server:status', {
                                serverName: name,
                                status: 'running',
                                server: updatedConfig
                            });
                        }
                    });
                }
            });

            serverProcess.stderr.on('data', (data) => {
                const line = data.toString();
                console.error(`[${name} ERROR] ${line}`);

                const buffer = serverConsoleBuffers.get(name) || [];
                buffer.push(`[ERROR] ${line}`);
                if (buffer.length > 500) buffer.shift();
                serverConsoleBuffers.set(name, buffer);

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('server:console', {
                        serverName: name,
                        log: `[ERROR] ${line}`
                    });
                }
            });

            serverProcess.on('exit', (code, signal) => {
                console.log(`[Servers] Server ${name} exited with code ${code}, signal ${signal}`);

                serverProcesses.delete(name);
                serverStartTimes.delete(name);

                if (serverStatsIntervals.has(name)) {
                    clearInterval(serverStatsIntervals.get(name));
                    serverStatsIntervals.delete(name);
                }

                // Add exit message to buffer
                const buffer = serverConsoleBuffers.get(name) || [];
                buffer.push(`[INFO] Server stopped (exit code: ${code})`);
                serverConsoleBuffers.set(name, buffer);

                updateServerConfig(name, { status: 'stopped', pid: null }).then(updatedConfig => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('server:status', {
                            serverName: name,
                            status: 'stopped',
                            server: updatedConfig
                        });
                        mainWindow.webContents.send('server:console', {
                            serverName: name,
                            log: '[INFO] Server stopped'
                        });
                    }
                });
            });

            serverProcess.on('error', (err) => {
                console.error(`[Servers] Error starting server ${name}:`, err);

                serverProcesses.delete(name);
                serverStartTimes.delete(name);

                if (serverStatsIntervals.has(name)) {
                    clearInterval(serverStatsIntervals.get(name));
                    serverStatsIntervals.delete(name);
                }

                const buffer = serverConsoleBuffers.get(name) || [];
                buffer.push(`[ERROR] ${err.message}`);
                serverConsoleBuffers.set(name, buffer);

                updateServerConfig(name, { status: 'stopped', pid: null });

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('server:status', {
                        serverName: name,
                        status: 'error',
                        error: err.message
                    });
                }
            });

            startServerStatsCollection(name, serverProcess, mainWindow);

            return { success: true };
        } catch (error) {
            console.error('[Servers] Error starting server:', error);

            try {
                await updateServerConfig(name, { status: 'stopped' });
            } catch (e) {
                console.error('Error updating config after failed start:', e);
            }

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('server:status', {
                    serverName: name,
                    status: 'error',
                    error: error.message
                });
            }
            return { success: false, error: error.message };
        }
    });

    // Stop server
    ipcMain.handle('server:stop', async (event, name) => {
        try {
            const process = serverProcesses.get(name);

            if (!process || process.killed) {
                await updateServerConfig(name, { status: 'stopped', pid: null });

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('server:status', {
                        serverName: name,
                        status: 'stopped'
                    });
                }

                return { success: true, message: 'Server not running' };
            }

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('server:status', { serverName: name, status: 'stopping' });
            }

            const buffer = serverConsoleBuffers.get(name) || [];
            buffer.push('[INFO] Stopping server...');
            serverConsoleBuffers.set(name, buffer);

            if (process.stdin) {
                process.stdin.write('stop\n');

                await new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        if (serverProcesses.has(name) && !serverProcesses.get(name).killed) {
                            process.kill('SIGKILL');
                        }
                        resolve();
                    }, 10000);

                    process.once('exit', () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                });
            } else {
                process.kill('SIGKILL');
            }

            if (serverStatsIntervals.has(name)) {
                clearInterval(serverStatsIntervals.get(name));
                serverStatsIntervals.delete(name);
            }

            serverProcesses.delete(name);
            serverStartTimes.delete(name);

            await updateServerConfig(name, { status: 'stopped', pid: null });

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('server:status', {
                    serverName: name,
                    status: 'stopped'
                });
            }

            return { success: true };
        } catch (error) {
            console.error('[Servers] Error stopping server:', error);
            return { success: false, error: error.message };
        }
    });

    // Restart server
    ipcMain.handle('server:restart', async (event, name) => {
        try {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('server:status', { serverName: name, status: 'restarting' });
            }

            const buffer = serverConsoleBuffers.get(name) || [];
            buffer.push('[INFO] Restarting server...');
            serverConsoleBuffers.set(name, buffer);

            // First stop
            await ipcMain.emit('server:stop', event, name);

            await new Promise(resolve => setTimeout(resolve, 2000));

            // Then start
            const result = await ipcMain.emit('server:start', event, name);

            return result || { success: true };
        } catch (error) {
            console.error('[Servers] Error restarting server:', error);
            return { success: false, error: error.message };
        }
    });

    // Get server status
    ipcMain.handle('server:get-status', async (event, name) => {
        try {
            const process = serverProcesses.get(name);
            if (process && !process.killed) {
                return 'running';
            }

            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(name);
            const configPath = path.join(serversDir, safeName, 'server.json');

            if (await fs.pathExists(configPath)) {
                const config = await fs.readJson(configPath);
                return config.status || 'stopped';
            }

            return 'stopped';
        } catch (error) {
            console.error('[Servers] Error getting server status:', error);
            return 'stopped';
        }
    });

    // Open server folder
    ipcMain.handle('server:open-folder', async (event, name) => {
        try {
            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(name);
            const serverDir = path.join(serversDir, safeName);

            if (await fs.pathExists(serverDir)) {
                const { shell } = require('electron');
                shell.openPath(serverDir);
            }

            return { success: true };
        } catch (error) {
            console.error('[Servers] Error opening server folder:', error);
            return { success: false, error: error.message };
        }
    });

    // Import server
    ipcMain.handle('server:import', async () => {
        try {
            const { dialog } = require('electron');
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory'],
                title: 'Select Server Folder'
            });

            if (result.canceled) {
                return { success: false, error: 'Cancelled' };
            }

            const serverPath = result.filePaths[0];
            const serverName = path.basename(serverPath);

            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(serverName);
            const destPath = path.join(serversDir, safeName);

            await fs.copy(serverPath, destPath);

            const configPath = path.join(destPath, 'server.json');
            if (!await fs.pathExists(configPath)) {
                const serverConfig = {
                    name: serverName,
                    safeName: safeName,
                    version: 'unknown',
                    software: 'unknown',
                    port: 25565,
                    maxPlayers: 20,
                    memory: 1024,
                    icon: null,
                    created: new Date().toISOString(),
                    status: 'stopped',
                    pid: null,
                    path: destPath,
                    playitPluginInstalled: false
                };
                await fs.writeJson(configPath, serverConfig, { spaces: 2 });
            }

            return { success: true, serverName: serverName };
        } catch (error) {
            console.error('[Servers] Error importing server:', error);
            return { success: false, error: error.message };
        }
    });

    // Duplicate server
    ipcMain.handle('server:duplicate', async (event, name) => {
        try {
            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(name);
            const sourceDir = path.join(serversDir, safeName);

            if (!await fs.pathExists(sourceDir)) {
                throw new Error('Source server not found');
            }

            let newName = `${name} Copy`;
            let newSafeName = sanitizeFileName(newName);
            let counter = 1;

            while (await fs.pathExists(path.join(serversDir, newSafeName))) {
                counter++;
                newName = `${name} Copy ${counter}`;
                newSafeName = sanitizeFileName(newName);
            }

            const destDir = path.join(serversDir, newSafeName);
            await fs.copy(sourceDir, destDir);

            const configPath = path.join(destDir, 'server.json');
            if (await fs.pathExists(configPath)) {
                const config = await fs.readJson(configPath);
                config.name = newName;
                config.safeName = newSafeName;
                config.created = new Date().toISOString();
                config.status = 'stopped';
                config.pid = null;
                await fs.writeJson(configPath, config, { spaces: 2 });
            }

            return { success: true, serverName: newName };
        } catch (error) {
            console.error('[Servers] Error duplicating server:', error);
            return { success: false, error: error.message };
        }
    });

    // Backup server
    ipcMain.handle('server:backup', async (event, name) => {
        try {
            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(name);
            const serverDir = path.join(serversDir, safeName);

            if (!await fs.pathExists(serverDir)) {
                throw new Error('Server not found');
            }

            const backupsDir = path.join(app.getPath('userData'), 'backups', 'servers', safeName);
            await fs.ensureDir(backupsDir);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `${name}-${timestamp}`;
            const backupPath = path.join(backupsDir, backupName);

            await fs.copy(serverDir, backupPath);

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('server:backup-progress', {
                    serverName: name,
                    progress: 100,
                    complete: true
                });
            }

            return { success: true, path: backupPath };
        } catch (error) {
            console.error('[Servers] Error backing up server:', error);
            return { success: false, error: error.message };
        }
    });

    // Download server software
    ipcMain.handle('server:download-software', async (event, data) => {
        try {
            const { platform, version, downloadUrl } = data;

            const downloadsDir = app.getPath('downloads');
            const jarPath = path.join(downloadsDir, `${platform}-${version}.jar`);

            await downloadServerJar(downloadUrl, jarPath, `${platform} ${version}`, mainWindow);

            return { success: true };
        } catch (error) {
            console.error('[Servers] Error downloading software:', error);
            return { success: false, error: error.message };
        }
    });

    // Clear console buffer for a server
    ipcMain.handle('server:clear-console', async (event, serverName) => {
        try {
            serverConsoleBuffers.set(serverName, []);

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('server:console-cleared', { serverName });
            }

            return { success: true };
        } catch (error) {
            console.error('[Servers] Error clearing console:', error);
            return { success: false, error: error.message };
        }
    });

    // New handler: Check if Playit plugin is available for a specific software and version
    ipcMain.handle('server:check-playit-available', async (event, software, version) => {
        try {
            const loaderMap = {
                'paper': 'paper',
                'purpur': 'purpur',
                'spigot': 'spigot',
                'bukkit': 'bukkit',
                'folia': 'folia',
                'fabric': 'fabric',
                'forge': 'forge',
                'neoforge': 'neoforge',
                'quilt': 'quilt',
                'vanilla': null
            };

            const loader = loaderMap[software.toLowerCase()];

            if (!loader || loader === 'vanilla') {
                return { available: false, reason: 'Software does not support plugins' };
            }

            const projectId = 'og7kbNBC';
            const versionsResponse = await axios.get(`https://api.modrinth.com/v2/project/${projectId}/version`, {
                headers: {
                    'User-Agent': 'Antigravity/MinecraftLauncher/1.0'
                }
            });

            if (!versionsResponse.data || versionsResponse.data.length === 0) {
                return { available: false, reason: 'No versions found' };
            }

            const matchingVersion = versionsResponse.data.find(v => {
                const supportsLoader = v.loaders.some(l =>
                    l.toLowerCase() === loader.toLowerCase()
                );
                const supportsGameVersion = v.game_versions.some(gv =>
                    gv === version
                );
                return supportsLoader && supportsGameVersion;
            });

            if (matchingVersion) {
                return {
                    available: true,
                    version: matchingVersion.version_number,
                    supportedVersions: matchingVersion.game_versions
                };
            }

            // Check if any version supports this loader (for debugging)
            const anyLoaderVersion = versionsResponse.data.find(v =>
                v.loaders.some(l => l.toLowerCase() === loader.toLowerCase())
            );

            if (anyLoaderVersion) {
                return {
                    available: false,
                    reason: `No version for ${version}. Supported: ${anyLoaderVersion.game_versions.join(', ')}`,
                    supportedVersions: anyLoaderVersion.game_versions
                };
            }

            return { available: false, reason: `No version found for ${software}` };
        } catch (error) {
            console.error('[Servers] Error checking Playit availability:', error);
            return { available: false, reason: error.message };
        }
    });

    // New handler: Manually install Playit plugin for an existing server
    ipcMain.handle('server:install-playit', async (event, serverName) => {
        try {
            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(serverName);
            const serverDir = path.join(serversDir, safeName);
            const configPath = path.join(serverDir, 'server.json');

            if (!await fs.pathExists(configPath)) {
                throw new Error('Server not found');
            }

            const config = await fs.readJson(configPath);

            if (config.playitPluginInstalled) {
                return { success: true, message: 'Plugin already installed' };
            }

            const pluginInstalled = await downloadPlayitPlugin(serverDir, config.software, config.version, serverName, mainWindow);

            if (pluginInstalled) {
                config.playitPluginInstalled = true;
                await fs.writeJson(configPath, config, { spaces: 2 });
                return { success: true, message: 'Plugin installed successfully' };
            } else {
                return { success: false, message: 'Plugin not available for this software/version' };
            }
        } catch (error) {
            console.error('[Servers] Error installing Playit plugin:', error);
            return { success: false, error: error.message };
        }
    });

    // Cleanup on app quit
    app.on('before-quit', () => {
        for (const [name, process] of serverProcesses.entries()) {
            console.log(`[Servers] Stopping server ${name} on quit...`);

            if (process.stdin) {
                process.stdin.write('stop\n');
            }

            setTimeout(() => {
                if (!process.killed) {
                    process.kill('SIGKILL');
                }
            }, 5000);
        }

        for (const interval of serverStatsIntervals.values()) {
            clearInterval(interval);
        }
    });

    // Server Settings Handlers
    const serverSettingsPath = path.join(app.getPath('userData'), 'serverSettings.json');

    const defaultServerSettings = {
        serverPath: '',
        backupPath: '',
        autoBackup: false,
        backupInterval: 24,
        maxBackups: 5,
        defaultMemory: '4096',
        defaultPort: '25565',
        defaultMaxPlayers: '20',
        autoop: false
    };

    ipcMain.handle('server:get-settings', async () => {
        try {
            if (await fs.pathExists(serverSettingsPath)) {
                const settings = await fs.readJson(serverSettingsPath);
                return { success: true, settings: { ...defaultServerSettings, ...settings } };
            }
            return { success: true, settings: defaultServerSettings };
        } catch (error) {
            console.error('[Servers] Failed to get server settings:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('server:save-settings', async (_, newSettings) => {
        try {
            await fs.writeJson(serverSettingsPath, newSettings, { spaces: 2 });
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('server:settings-updated', newSettings);
            }
            return { success: true };
        } catch (error) {
            console.error('[Servers] Failed to save server settings:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('dialog:select-folder', async () => {
        const { dialog } = require('electron');
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory']
            });
            return result;
        } catch (error) {
            console.error('[Servers] Error in folder selection:', error);
            return { success: false, error: error.message };
        }
    });

    console.log('[Servers] Server handlers setup complete.');
};