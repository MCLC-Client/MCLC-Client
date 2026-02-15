const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { app } = require('electron');
const axios = require('axios');
const { createWriteStream } = require('fs');
const { spawn } = require('child_process');
const readline = require('readline');
const os = require('os');

// Store running server processes
const serverProcesses = new Map();
// Store server stats intervals
const serverStatsIntervals = new Map();
// Store server process start times
const serverStartTimes = new Map();

function sanitizeFileName(name) {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

async function downloadServerJar(url, destination, serverName, mainWindow) {
    try {
        const writer = createWriteStream(destination);
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            onDownloadProgress: (progressEvent) => {
                if (progressEvent.total) {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    if (mainWindow) {
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

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        console.error('Error downloading server jar:', error);
        throw error;
    }
}

// Update server config
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

// Get process stats (CPU and Memory)
async function getProcessStats(pid) {
    try {
        if (!pid) return { cpu: 0, memory: 0 };

        if (process.platform === 'win32') {
            // Windows: Use wmic to get process stats
            return new Promise((resolve) => {
                const { exec } = require('child_process');
                exec(`wmic process where ProcessId=${pid} get WorkingSetSize,PercentProcessorTime /format:csv`, (error, stdout) => {
                    if (error) {
                        resolve({ cpu: 0, memory: 0 });
                        return;
                    }

                    const lines = stdout.trim().split('\n');
                    if (lines.length > 1) {
                        const parts = lines[1].split(',');
                        if (parts.length >= 3) {
                            const memory = parseInt(parts[2]) || 0; // WorkingSetSize in bytes
                            const cpu = parseFloat(parts[1]) || 0; // PercentProcessorTime
                            resolve({
                                cpu: Math.min(Math.round(cpu), 100),
                                memory: Math.round(memory / (1024 * 1024)) // Convert to MB
                            });
                        } else {
                            resolve({ cpu: 0, memory: 0 });
                        }
                    } else {
                        resolve({ cpu: 0, memory: 0 });
                    }
                });
            });
        } else {
            // Linux/Mac: Use ps command
            return new Promise((resolve) => {
                const { exec } = require('child_process');
                exec(`ps -o %cpu,rss -p ${pid} --no-headers`, (error, stdout) => {
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
                            memory: Math.round(memoryKB / 1024) // Convert KB to MB
                        });
                    } else {
                        resolve({ cpu: 0, memory: 0 });
                    }
                });
            });
        }
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
            if (!process || process.killed || !process.pid) {
                return;
            }

            // Get process stats
            const stats = await getProcessStats(process.pid);

            // Calculate uptime
            const startTime = serverStartTimes.get(serverName) || Date.now();
            const uptime = Math.floor((Date.now() - startTime) / 1000);

            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('server:stats', {
                    serverName,
                    cpu: stats.cpu,
                    memory: stats.memory,
                    uptime: uptime,
                    players: [] // Players would need to be parsed from server logs
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

    // Check if EULA is accepted
    ipcMain.handle('server:check-eula', async (event, serverName) => {
        try {
            console.log(`[Servers] Checking EULA for ${serverName}`);

            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(serverName);
            const serverDir = path.join(serversDir, safeName);
            const eulaPath = path.join(serverDir, 'eula.txt');

            // Check if eula.txt exists
            if (!await fs.pathExists(eulaPath)) {
                console.log(`[Servers] eula.txt not found for ${serverName}`);
                return false;
            }

            // Read eula.txt
            const eulaContent = await fs.readFile(eulaPath, 'utf-8');

            // Check if eula=true is set
            const eulaAccepted = eulaContent.includes('eula=true');

            console.log(`[Servers] EULA for ${serverName} is ${eulaAccepted ? 'accepted' : 'not accepted'}`);

            return eulaAccepted;
        } catch (error) {
            console.error(`[Servers] Error checking EULA for ${serverName}:`, error);
            return false;
        }
    });

    // Accept EULA
    ipcMain.handle('server:accept-eula', async (event, serverName) => {
        try {
            console.log(`[Servers] Accepting EULA for ${serverName}`);

            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(serverName);
            const serverDir = path.join(serversDir, safeName);
            const eulaPath = path.join(serverDir, 'eula.txt');

            // Create eula.txt with accepted EULA
            const eulaContent = `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).
#${new Date().toISOString()}
eula=true
`;
            await fs.writeFile(eulaPath, eulaContent);

            console.log(`[Servers] EULA accepted for ${serverName}`);

            // Send notification that EULA was accepted
            if (mainWindow && mainWindow.webContents) {
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

    // ==================== EXISTING FUNCTIONS ====================

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

                        // Save updated status
                        await fs.writeJson(configPath, config, { spaces: 2 });

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
            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(serverName);
            const serverDir = path.join(serversDir, safeName);
            const logPath = path.join(serverDir, 'logs', 'latest.log');

            if (await fs.pathExists(logPath)) {
                const log = await fs.readFile(logPath, 'utf-8');
                // Return last 100 lines
                return log.split('\n').filter(line => line.trim()).slice(-100);
            }

            // Check for other log files
            const logsDir = path.join(serverDir, 'logs');
            if (await fs.pathExists(logsDir)) {
                const files = await fs.readdir(logsDir);
                const latestLog = files
                    .filter(f => f.endsWith('.log') || f.endsWith('.txt'))
                    .sort()
                    .reverse()[0];

                if (latestLog) {
                    const log = await fs.readFile(path.join(logsDir, latestLog), 'utf-8');
                    return log.split('\n').filter(line => line.trim()).slice(-100);
                }
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

            // Get current stats
            const stats = await getProcessStats(process.pid);
            const startTime = serverStartTimes.get(serverName) || Date.now();
            const uptime = Math.floor((Date.now() - startTime) / 1000);

            return {
                cpu: stats.cpu,
                memory: stats.memory,
                uptime: uptime,
                players: []
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

            // Remove leading slash if present (Minecraft server commands don't use slashes)
            const cleanCommand = command.startsWith('/') ? command.substring(1) : command;

            // Write command to server stdin
            process.stdin.write(cleanCommand + '\n');

            // Log command to console
            if (mainWindow && mainWindow.webContents) {
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
            console.log('[Servers] Received server data:', data);

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

            // Create server directory
            await fs.ensureDir(serverDir);
            await fs.ensureDir(path.join(serverDir, 'logs'));
            await fs.ensureDir(path.join(serverDir, 'plugins'));

            // Create server config
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
                path: serverDir
            };

            await fs.writeJson(path.join(serverDir, 'server.json'), serverConfig, { spaces: 2 });

            // Create server.properties
            const serverProperties = `#Minecraft server properties
#${new Date().toISOString()}
server-port=${port || 25565}
max-players=${maxPlayers || 20}
motd=A Minecraft Server
online-mode=true
`;

            await fs.writeFile(path.join(serverDir, 'server.properties'), serverProperties);

            // Create eula.txt (default to false)
            const eulaContent = `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).
#${new Date().toISOString()}
eula=false
`;
            await fs.writeFile(path.join(serverDir, 'eula.txt'), eulaContent);

            // Download server jar if URL provided
            if (downloadUrl) {
                const jarPath = path.join(serverDir, 'server.jar');

                // Send download started notification
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('server:status', {
                        serverName: name,
                        status: 'downloading'
                    });
                }

                // Start download in background
                downloadServerJar(downloadUrl, jarPath, name, mainWindow)
                    .then(() => {
                        console.log(`[Servers] Server jar downloaded for ${name}`);
                        if (mainWindow && mainWindow.webContents) {
                            mainWindow.webContents.send('server:status', {
                                serverName: name,
                                status: 'ready'
                            });
                        }
                    })
                    .catch(err => {
                        console.error(`[Servers] Failed to download jar for ${name}:`, err);
                        if (mainWindow && mainWindow.webContents) {
                            mainWindow.webContents.send('server:status', {
                                serverName: name,
                                status: 'error',
                                error: err.message
                            });
                        }
                    });
            }

            return { success: true, serverName: name };
        } catch (error) {
            console.error('[Servers] Error creating server:', error);
            return { success: false, error: error.message };
        }
    });

    // Delete server
    ipcMain.handle('server:delete', async (event, name) => {
        try {
            // Stop server if running
            const process = serverProcesses.get(name);
            if (process && !process.killed) {
                process.kill();
                serverProcesses.delete(name);
                serverStartTimes.delete(name);
            }

            // Clear stats interval
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
                    // Send EULA required event
                    if (mainWindow && mainWindow.webContents) {
                        mainWindow.webContents.send('server:eula-required', { serverName: name });
                    }
                    throw new Error('EULA not accepted');
                }
            } else {
                // Create eula.txt with default false
                const eulaContent = `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).
#${new Date().toISOString()}
eula=false
`;
                await fs.writeFile(eulaPath, eulaContent);

                // Send EULA required event
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('server:eula-required', { serverName: name });
                }
                throw new Error('EULA not accepted');
            }

            const config = await fs.readJson(configPath);

            // Check if already running
            if (serverProcesses.has(name) && !serverProcesses.get(name).killed) {
                throw new Error('Server is already running');
            }

            // Send status update
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('server:status', { serverName: name, status: 'starting' });
            }

            // Update config
            config.status = 'starting';
            await fs.writeJson(configPath, config, { spaces: 2 });

            // Find Java executable
            const javaPath = 'java'; // Assume java is in PATH

            // Build Java arguments
            const javaArgs = [
                `-Xms${config.memory}M`,
                `-Xmx${config.memory}M`,
                '-jar',
                'server.jar',
                'nogui'
            ];

            console.log(`[Servers] Starting server ${name} with: ${javaPath} ${javaArgs.join(' ')}`);

            // Spawn Java process
            const serverProcess = spawn(javaPath, javaArgs, {
                cwd: serverDir,
                detached: false,
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true
            });

            // Store process and start time
            serverProcesses.set(name, serverProcess);
            serverStartTimes.set(name, Date.now());

            // Handle stdout
            const rl = readline.createInterface({
                input: serverProcess.stdout,
                output: null
            });

            rl.on('line', (line) => {
                console.log(`[${name}] ${line}`);

                // Send log to renderer
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('server:console', {
                        serverName: name,
                        log: line
                    });
                }

                // Check for server ready message
                if (line.includes('Done') && line.includes('For help, type "help"')) {
                    updateServerConfig(name, { status: 'running' }).then(updatedConfig => {
                        if (mainWindow && mainWindow.webContents) {
                            mainWindow.webContents.send('server:status', {
                                serverName: name,
                                status: 'running',
                                server: updatedConfig
                            });
                        }
                    });
                }
            });

            // Handle stderr
            serverProcess.stderr.on('data', (data) => {
                const line = data.toString();
                console.error(`[${name} ERROR] ${line}`);

                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('server:console', {
                        serverName: name,
                        log: `[ERROR] ${line}`
                    });
                }
            });

            // Handle process exit
            serverProcess.on('exit', (code, signal) => {
                console.log(`[Servers] Server ${name} exited with code ${code}, signal ${signal}`);

                serverProcesses.delete(name);
                serverStartTimes.delete(name);

                // Clear stats interval
                if (serverStatsIntervals.has(name)) {
                    clearInterval(serverStatsIntervals.get(name));
                    serverStatsIntervals.delete(name);
                }

                updateServerConfig(name, { status: 'stopped', pid: null }).then(updatedConfig => {
                    if (mainWindow && mainWindow.webContents) {
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

            // Handle process error
            serverProcess.on('error', (err) => {
                console.error(`[Servers] Error starting server ${name}:`, err);

                serverProcesses.delete(name);
                serverStartTimes.delete(name);

                if (serverStatsIntervals.has(name)) {
                    clearInterval(serverStatsIntervals.get(name));
                    serverStatsIntervals.delete(name);
                }

                updateServerConfig(name, { status: 'stopped', pid: null });

                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('server:status', {
                        serverName: name,
                        status: 'error',
                        error: err.message
                    });
                }
            });

            // Start collecting stats
            startServerStatsCollection(name, serverProcess, mainWindow);

            return { success: true };
        } catch (error) {
            console.error('[Servers] Error starting server:', error);

            // Update config
            try {
                await updateServerConfig(name, { status: 'stopped' });
            } catch (e) {
                console.error('Error updating config after failed start:', e);
            }

            if (mainWindow && mainWindow.webContents) {
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
                // Update config to stopped
                await updateServerConfig(name, { status: 'stopped', pid: null });

                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('server:status', {
                        serverName: name,
                        status: 'stopped'
                    });
                }

                return { success: true, message: 'Server not running' };
            }

            // Send status update
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('server:status', { serverName: name, status: 'stopping' });
            }

            // Try graceful shutdown with /stop command
            if (process.stdin) {
                process.stdin.write('stop\n');

                // Wait for process to exit gracefully
                await new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        // Force kill if not stopped after 10 seconds
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
                // Force kill if no stdin
                process.kill('SIGKILL');
            }

            // Clear stats interval
            if (serverStatsIntervals.has(name)) {
                clearInterval(serverStatsIntervals.get(name));
                serverStatsIntervals.delete(name);
            }

            serverProcesses.delete(name);
            serverStartTimes.delete(name);

            // Update config
            await updateServerConfig(name, { status: 'stopped', pid: null });

            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('server:status', {
                    serverName: name,
                    status: 'stopped'
                });
                mainWindow.webContents.send('server:console', {
                    serverName: name,
                    log: '[INFO] Server stopped'
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
            // Send restarting status
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('server:status', { serverName: name, status: 'restarting' });
            }

            // First stop
            await ipcMain.emit('server:stop', event, name);

            // Wait a bit
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

            // Copy to servers directory
            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(serverName);
            const destPath = path.join(serversDir, safeName);

            await fs.copy(serverPath, destPath);

            // Check if server.json exists, if not create it
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
                    path: destPath
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

            // Find a new name
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

            // Update config with new name
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

            // Create backup
            await fs.copy(serverDir, backupPath);

            if (mainWindow && mainWindow.webContents) {
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
            const { name, downloadUrl } = data;

            const serversDir = path.join(app.getPath('userData'), 'servers');
            const safeName = sanitizeFileName(name);
            const serverDir = path.join(serversDir, safeName);
            const jarPath = path.join(serverDir, 'server.jar');

            await downloadServerJar(downloadUrl, jarPath, name, mainWindow);

            return { success: true };
        } catch (error) {
            console.error('[Servers] Error downloading software:', error);
            return { success: false, error: error.message };
        }
    });

    // Cleanup on app quit
    app.on('before-quit', () => {
        // Stop all server processes
        for (const [name, process] of serverProcesses.entries()) {
            console.log(`[Servers] Stopping server ${name} on quit...`);

            if (process.stdin) {
                process.stdin.write('stop\n');
            }

            // Give it a moment to shut down gracefully
            setTimeout(() => {
                if (!process.killed) {
                    process.kill('SIGKILL');
                }
            }, 5000);
        }

        // Clear all intervals
        for (const interval of serverStatsIntervals.values()) {
            clearInterval(interval);
        }
    });

    console.log('[Servers] Server handlers setup complete.');
};