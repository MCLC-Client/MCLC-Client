const { Client } = require('minecraft-launcher-core');
const path = require('path');
const { app } = require('electron');
const fs = require('fs-extra');
const Store = require('electron-store');
const store = new Store();

module.exports = (ipcMain, mainWindow) => {
    // Track running instances in memory: name -> startTime
    const runningInstances = new Map();
    const liveLogs = new Map(); // name -> array of strings
    const childProcesses = new Map(); // name -> ChildProcess object
    const activeLaunches = new Map(); // name -> { cancelled: boolean }

    // Helper to set window title on Windows (Ultra High Performance / C# Injection)
    function setWindowTitle(pid, title) {
        if (process.platform !== 'win32') return;

        const { exec } = require('child_process');

        // Wir kompilieren C# Code "on-the-fly". Das läuft fast so schnell wie eine native .exe
        // Es prüft den Titel alle 10ms (100x pro Sekunde) ohne CPU-Last.
        const script = `
$code = @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;
using System.Threading;

public class TitleFixer {
    [DllImport("user32.dll")]
    public static extern bool SetWindowText(IntPtr hWnd, string lpString);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);

    public static void Run(int pid, string targetTitle) {
        Process p = null;
        try { p = Process.GetProcessById(pid); } catch { return; }
        
        IntPtr handle = IntPtr.Zero;
        StringBuilder sb = new StringBuilder(512);
        
        while (!p.HasExited) {
            try {
                // Handle holen oder aktualisieren, falls Fenster neu erstellt wurde (z.B. Fullscreen Toggle)
                if (handle == IntPtr.Zero || !IsWindow(handle)) {
                    p.Refresh();
                    handle = p.MainWindowHandle;
                }

                if (handle != IntPtr.Zero) {
                    sb.Clear();
                    GetWindowText(handle, sb, sb.Capacity);
                    
                    string current = sb.ToString();
                    if (current != targetTitle && !string.IsNullOrEmpty(current)) {
                        // Minecraft detected!
                        SetWindowText(handle, targetTitle);
                        
                        // Wait a bit to avoid fighting in the same frame
                        Thread.Sleep(200);
                    }
                }
            } catch {
                // Fehler ignorieren
            }
            
            // Check every 200ms when idle
            Thread.Sleep(200);
        }
    }
}
"@

Add-Type -TypeDefinition $code -Language CSharp
[TitleFixer]::Run(${pid}, "${title.replace(/"/g, '`"')}")
        `;

        const b64 = Buffer.from(script, 'utf16le').toString('base64');

        // Wichtig: windowsHide: true, damit kein Fenster aufpoppt
        exec(`powershell -ExecutionPolicy Bypass -NoProfile -EncodedCommand ${b64}`, { windowsHide: true }, (err) => {
            if (err) console.error('[Launcher] Title watcher ended:', err);
        });
    }

    ipcMain.handle('launcher:abort-launch', async (_, instanceName) => {
        if (activeLaunches.has(instanceName)) {
            activeLaunches.get(instanceName).cancelled = true;
            console.log(`[Launcher] Mark launch cancelled for ${instanceName}`);
            return { success: true };
        }
        return { success: false, error: 'No active launch found to abort' };
    });

    ipcMain.handle('launcher:get-live-logs', (_, instanceName) => {
        return liveLogs.get(instanceName) || [];
    });

    ipcMain.handle('launcher:kill', async (_, instanceName) => {
        // If the process is already running, kill it
        const proc = childProcesses.get(instanceName);
        if (proc && !proc.killed) {
            try {
                // On Windows, we need to kill the entire process tree
                if (process.platform === 'win32') {
                    const { exec } = require('child_process');
                    exec(`taskkill /pid ${proc.pid} /T /F`, (err) => {
                        if (err) console.error('Failed to kill process tree:', err);
                    });
                } else {
                    proc.kill('SIGTERM');
                }
                childProcesses.delete(instanceName);
                runningInstances.delete(instanceName);
                liveLogs.delete(instanceName);
                mainWindow.webContents.send('instance:status', { instanceName, status: 'stopped' });
                return { success: true };
            } catch (e) {
                return { success: false, error: e.message };
            }
        }

        return { success: false, error: 'No running process found for this instance.' };
    });

    ipcMain.handle('launcher:launch', async (_, instanceName, quickPlay) => {
        if (runningInstances.has(instanceName) || activeLaunches.has(instanceName)) {
            console.warn(`[Launcher] Blocked launch attempt for ${instanceName} - Already ${activeLaunches.has(instanceName) ? 'launching' : 'running'}`);
            return { success: false, error: 'Instance is already running or launching' };
        }

        activeLaunches.set(instanceName, { cancelled: false });

        try {
            const instanceDir = path.join(app.getPath('userData'), 'instances', instanceName);
            const configPath = path.join(instanceDir, 'instance.json');

            if (!await fs.pathExists(configPath)) return { success: false, error: 'Instance not found' };

            const config = await fs.readJson(configPath);

            // Get stored user profile for authentication
            const userProfile = store.get('user_profile');
            if (!userProfile || !userProfile.access_token) {
                return { success: false, error: 'Not logged in. Please login first.' };
            }

            // Load Settings
            const settingsPath = path.join(app.getPath('userData'), 'settings.json');
            let settings = {
                javaPath: '',
                minMemory: 1024,
                maxMemory: 4096,
                resolutionWidth: 854,
                resolutionHeight: 480
            };
            if (await fs.pathExists(settingsPath)) {
                try {
                    const saved = await fs.readJson(settingsPath);
                    settings = { ...settings, ...saved };
                } catch (e) {
                    console.error("Failed to load settings for launch", e);
                }
            }


            // Apply instance-specific overrides if they exist
            if (config.javaPath) settings.javaPath = config.javaPath;
            if (config.minMemory) settings.minMemory = config.minMemory;
            if (config.maxMemory) settings.maxMemory = config.maxMemory;
            if (config.resolutionWidth) settings.resolutionWidth = config.resolutionWidth;
            if (config.resolutionHeight) settings.resolutionHeight = config.resolutionHeight;

            // Shared Assets Directory to speed up launch and save space
            const sharedDir = path.join(app.getPath('userData'), 'common');
            await fs.ensureDir(sharedDir);

            // Build launch options with REAL auth from stored profile
            let opts = {
                clientPackage: null,
                authorization: {
                    access_token: userProfile.access_token,
                    client_token: userProfile.uuid,
                    uuid: userProfile.uuid,
                    name: userProfile.name,
                    user_properties: {}
                },
                root: instanceDir,
                overrides: {
                    detached: false,
                    assetRoot: path.join(sharedDir, 'assets')
                },
                version: {
                    number: config.version,
                    type: "release"
                },
                memory: {
                    max: `${settings.maxMemory}M`,
                    min: `${settings.minMemory}M`
                },
                window: {
                    width: settings.resolutionWidth,
                    height: settings.resolutionHeight
                }
            };

            console.log(`[Launcher] Launching with: version=${opts.version.number}, loader=${config.loader}`);

            // Add mod loader configuration using stored versionId if it's a modded instance
            if (config.versionId && config.loader && config.loader.toLowerCase() !== 'vanilla') {
                opts.version.custom = config.versionId;
                console.log(`Launching with ${config.loader} custom profile: ${config.versionId}`);
            }

            if (settings.javaPath && settings.javaPath.trim() !== '') {
                let jPath = settings.javaPath;
                // On Windows, java.exe opens a console window. javaw.exe does not.
                if (process.platform === 'win32') {
                    // Normalize path separators
                    jPath = path.normalize(jPath);
                    if (jPath.toLowerCase().endsWith('java.exe')) {
                        // Try to find javaw.exe in the same directory
                        const javawPath = jPath.slice(0, -8) + 'javaw.exe';
                        if (fs.existsSync(javawPath)) {
                            console.log(`[Launcher] Found javaw.exe, switching from java.exe to suppress console window: ${javawPath}`);
                            jPath = javawPath;
                        } else {
                            console.warn(`[Launcher] Could not find javaw.exe at ${javawPath}, continuing with java.exe`);
                        }
                    }
                }
                opts.javaPath = jPath;
            }

            const { installJava } = require('../utils/java-utils');

            function getRequiredJavaVersion(mcVersion) {
                // Simplified version parsing
                const v = mcVersion.split('.');
                const major = parseInt(v[0]);
                const minor = parseInt(v[1]);
                const patch = parseInt(v[2] || 0);

                if (minor >= 21) return 21; // Actually 1.20.5+ but minor 21 is safe for future 1.21
                if (minor === 20 && patch >= 5) return 21;
                if (minor >= 17) return 17;
                return 8;
            }

            let javaToCheck = opts.javaPath || 'java';
            let javaValid = false;
            let javaOutput = '';

            const performJavaCheck = (p) => {
                try {
                    const { execSync } = require('child_process');
                    javaOutput = execSync(`"${p}" -version 2>&1`, { encoding: 'utf8' });
                    return true;
                } catch (e) {
                    return false;
                }
            };

            javaValid = performJavaCheck(javaToCheck);

            // If invalid or missing, try auto-install
            if (!javaValid) {
                const reqVersion = getRequiredJavaVersion(config.version);
                console.log(`[Launcher] Java not found or invalid. Attempting auto-install of Java ${reqVersion}...`);

                mainWindow.webContents.send('install:progress', {
                    instanceName,
                    progress: 0,
                    status: `Installing Java ${reqVersion} (required for MC ${config.version})...`
                });

                const runtimesDir = path.join(app.getPath('userData'), 'runtimes');
                const installRes = await installJava(reqVersion, runtimesDir, (step, progress) => {
                    mainWindow.webContents.send('install:progress', {
                        instanceName,
                        progress,
                        status: step
                    });
                });

                if (installRes.success) {
                    javaToCheck = installRes.path;
                    opts.javaPath = javaToCheck;
                    javaValid = performJavaCheck(javaToCheck);

                    // Also update settings so it's remembered if not overridden
                    if (!config.javaPath) {
                        try {
                            const newSettings = { ...settings, javaPath: javaToCheck };
                            await fs.writeJson(settingsPath, newSettings, { spaces: 4 });
                            app.emit('settings-updated', newSettings);
                        } catch (e) { console.error("Failed to save auto-installed java path", e); }
                    }
                }
            }

            if (!javaValid) {
                runningInstances.delete(instanceName);
                activeLaunches.delete(instanceName);
                return {
                    success: false,
                    error: `Java not found or invalid even after attempted installation. Please check your settings.`
                };
            }

            // Check for 64-bit Java with high memory
            const is64Bit = javaOutput.includes('64-Bit');
            const maxMem = parseInt(opts.memory.max) || 4096;

            if (!is64Bit && maxMem > 1536) {
                return {
                    success: false,
                    error: `You are using 32-bit Java with ${maxMem}MB memory. 32-bit Java has a limit of ~1.5GB. Please install 64-bit Java or reduce memory.`
                };
            }

            console.log(`[Launcher] Final launch options for ${instanceName}:`, {
                version: opts.version,
                memory: opts.memory,
                javaPath: opts.javaPath || 'default'
            });

            // Special handling for NeoForge: It requires specific JVM arguments for Java module compatibility
            if (config.loader && config.loader.toLowerCase() === 'neoforge') {
                const neoForgeArgs = [
                    `-DlibraryDirectory=${path.join(instanceDir, 'libraries')}`,
                    "--add-modules=ALL-SYSTEM",
                    "--add-opens=java.base/java.util.jar=ALL-UNNAMED",
                    "--add-opens=java.base/java.lang.invoke=ALL-UNNAMED",
                    "--add-opens=java.base/java.lang.reflect=ALL-UNNAMED",
                    "--add-opens=java.base/java.io=ALL-UNNAMED",
                    "--add-opens=java.base/java.nio=ALL-UNNAMED",
                    "--add-opens=java.base/java.util=ALL-UNNAMED",
                    "--add-opens=java.base/java.time=ALL-UNNAMED",
                    "--add-opens=java.base/sun.security.util=ALL-UNNAMED",
                    "--add-opens=java.base/sun.io=ALL-UNNAMED",
                    "--add-opens=java.logging/java.util.logging=ALL-UNNAMED"
                ];

                if (opts.customArgs) {
                    if (Array.isArray(opts.customArgs)) {
                        opts.customArgs.push(...neoForgeArgs);
                    } else {
                        opts.customArgs = [...neoForgeArgs];
                    }
                } else {
                    opts.customArgs = neoForgeArgs;
                }
                console.log("Added NeoForge JVM arguments");
            }

            // Stable Window Title Tier 1: JVM Arguments
            if (!opts.customArgs) opts.customArgs = [];
            opts.customArgs.push(`-Dorg.lwjgl.opengl.Window.name=MCLC Client ${config.version || ''}`);
            opts.customArgs.push(`-Dorg.lwjgl.Display.title=MCLC Client ${config.version || ''}`);
            // Tier 1.5: Version Type (often shown in title)
            opts.version.type = "MCLC Client";

            if (config.loader && config.loader.toLowerCase() !== 'vanilla') {
                if (!config.versionId) {
                    return { success: false, error: `Instance configuration incomplete (missing versionId). Please reinstall ${instanceName}.` };
                }
                const specificVersionDir = path.join(instanceDir, 'versions', config.versionId);
                if (!await fs.pathExists(specificVersionDir)) {
                    return { success: false, error: `Mod loader files missing for ${config.versionId}. Please reinstall.` };
                }
            }

            const launcher = new Client();

            // Initialize live logs buffer for this instance
            liveLogs.set(instanceName, []);



            // Execute pre-launch hook if configured
            if (config.preLaunchHook && config.preLaunchHook.trim()) {
                try {
                    const { execSync } = require('child_process');
                    execSync(config.preLaunchHook, { cwd: instanceDir, stdio: 'inherit' });
                } catch (e) {
                    console.error('Pre-launch hook failed:', e.message);
                }
            }

            // Emit launching status
            mainWindow.webContents.send('instance:status', { instanceName, status: 'launching' });
            runningInstances.set(instanceName, Date.now());

            // Update Discord RPC
            try {
                const discord = require('./discord');
                discord.setActivity(`Playing ${instanceName}`, 'Starting Game...', 'mclc_icon', 'MCLC', runningInstances.get(instanceName));
            } catch (e) { /* ignore */ }

            // Track if we've seen a crash pattern in logs
            let logCrashDetected = false;
            const crashPatterns = [
                'Failed to start Minecraft!',
                'FormattedException',
                'IllegalAccessException',
                'NoClassDefFoundError',
                'java.lang.NoSuchMethodError',
                'Exception in thread "main"'
            ];

            // Discord connection tracking

            // Log buffering helper
            const appendLog = (data) => {
                const line = data.toString();

                // Check for crash patterns
                if (!logCrashDetected) {
                    for (const pattern of crashPatterns) {
                        if (line.includes(pattern)) {
                            console.log(`[Launcher] Detected potential crash pattern in logs: ${pattern}`);
                            logCrashDetected = true;
                            break;
                        }
                    }
                }

                // Process logs line by line
                const lines = line.split(/\r?\n/);
                for (const l of lines) {
                    if (!l.trim()) continue;
                    // Any future per-line processing goes here
                }

                const logs = liveLogs.get(instanceName) || [];
                logs.push(line);
                if (logs.length > 1000) logs.shift();
                liveLogs.set(instanceName, logs);
                mainWindow.webContents.send('launch:log', line);
            };

            launcher.on('debug', (line) => appendLog(`[DEBUG] ${line}`));
            launcher.on('data', (line) => appendLog(line));
            launcher.on('stderr', (line) => appendLog(`[ERROR] ${line}`));
            launcher.on('progress', (e) => {
                mainWindow.webContents.send('launch:progress', { ...e, instanceName });
            });

            launcher.on('arguments', (e) => {
                mainWindow.webContents.send('instance:status', { instanceName, status: 'running' });
                try {
                    const discord = require('./discord');
                    discord.setActivity(`Playing ${instanceName}`, 'In Game', 'minecraft', 'Minecraft', runningInstances.get(instanceName));
                } catch (e) { /* ignore */ }
            });

            launcher.on('close', async (code) => {
                console.log(`[Launcher] MC Process closed with code: ${code}, logCrashDetected: ${logCrashDetected}`);

                const startTime = runningInstances.get(instanceName);
                if (startTime) {
                    const sessionTime = Date.now() - startTime;
                    console.log(`[Launcher] Session finished for ${instanceName}. Duration: ${sessionTime}ms`);

                    try {
                        const currentConfig = await fs.readJson(configPath);
                        currentConfig.playtime = (currentConfig.playtime || 0) + sessionTime;
                        currentConfig.lastPlayed = Date.now();
                        await fs.writeJson(configPath, currentConfig, { spaces: 4 });

                        // Also update a separate text file as backup/easy read
                        const playtimePath = path.join(instanceDir, 'playtime.txt');
                        await fs.writeFile(playtimePath, String(currentConfig.playtime));

                        console.log(`[Launcher] Updated total playtime for ${instanceName}: ${currentConfig.playtime}ms`);

                        // Handle Crashes & mclo.gs Upload
                        // Handle Crashes & mclo.gs Upload
                        // const sessionTime = Date.now() - startTime; // Use outer scope
                        const isShortSession = sessionTime < 15000;
                        const isCrash = (code !== 0 && code !== null) || logCrashDetected || isShortSession;

                        if (isCrash) {
                            console.log(`[Launcher] Crash/Early Exit detected for ${instanceName} (Exit code: ${code}, LogCrash: ${logCrashDetected}, Duration: ${sessionTime}ms).`);

                            let logUrl = null;
                            const settings = store.get('settings') || {};
                            if (settings.autoUploadLogs) {
                                console.log('[Launcher] autoUploadLogs is enabled, uploading to mclo.gs...');
                                const logPath = path.join(instanceDir, 'logs', 'latest.log');
                                if (await fs.pathExists(logPath)) {
                                    try {
                                        const logContent = await fs.readFile(logPath, 'utf8');
                                        const axios = require('axios');
                                        const qs = require('querystring');
                                        const response = await axios.post('https://api.mclo.gs/1/log', qs.stringify({
                                            content: logContent
                                        }), {
                                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                                        });

                                        if (response.data && response.data.success) {
                                            logUrl = response.data.url;
                                            console.log(`[Launcher] Logs uploaded to mclo.gs: ${logUrl}`);
                                        }
                                    } catch (err) {
                                        console.error('[Launcher] Failed to upload logs to mclo.gs:', err.message);
                                    }
                                }
                            }

                            // Always notify frontend about the crash
                            mainWindow.webContents.send('launcher:crash-report', {
                                instanceName,
                                exitCode: code,
                                logUrl: logUrl
                            });
                        }
                    } catch (err) {
                        console.error("[Launcher] Failed to update instance data after close:", err);
                    }

                    runningInstances.delete(instanceName);
                }

                childProcesses.delete(instanceName);
                liveLogs.delete(instanceName);
                mainWindow.webContents.send('instance:status', { instanceName, status: 'stopped' });

                try {
                    const discord = require('./discord');
                    discord.setActivity('In Launcher', 'Idle', 'minecraft', 'Minecraft');
                } catch (e) { /* ignore */ }
            });

            try {
                // Check cancellation before spawn
                if (activeLaunches.get(instanceName)?.cancelled) {
                    console.log(`[Launcher] Launch aborted before spawn for ${instanceName}`);
                    activeLaunches.delete(instanceName);
                    runningInstances.delete(instanceName);
                    liveLogs.delete(instanceName);
                    mainWindow.webContents.send('instance:status', { instanceName, status: 'stopped' });
                    return { success: false, error: 'Launch aborted' };
                }

                activeLaunches.delete(instanceName); // active launch phase over, now running phase

                // QuickPlay: auto-join a world or server on launch
                if (quickPlay) {
                    if (!opts.customLaunchArgs) opts.customLaunchArgs = [];
                    if (quickPlay.world) {
                        // Use --quickPlaySingleplayer for 1.20+ and --world for older versions
                        const v = config.version.split('.');
                        const minor = parseInt(v[1]) || 0;
                        if (minor >= 20) {
                            opts.customLaunchArgs.push('--quickPlaySingleplayer', quickPlay.world);
                        }
                        console.log(`[Launcher] QuickPlay: World "${quickPlay.world}"`);
                    } else if (quickPlay.server) {
                        opts.customLaunchArgs.push('--quickPlayMultiplayer', quickPlay.server);
                        console.log(`[Launcher] QuickPlay: Server "${quickPlay.server}"`);
                    }
                }

                const proc = await launcher.launch(opts);
                if (proc && proc.pid) {
                    childProcesses.set(instanceName, proc);
                    setWindowTitle(proc.pid, `MCLC Client ${opts.version.number}`);
                } else {
                    console.error('[Launcher] Launch failed: No valid process returned from MCLC.', proc);
                    runningInstances.delete(instanceName);
                    activeLaunches.delete(instanceName);
                    liveLogs.delete(instanceName);
                    mainWindow.webContents.send('instance:status', { instanceName, status: 'stopped' });
                    return { success: false, error: 'Failed to start Minecraft process (no PID returned)' };
                }
            } catch (e) {
                console.error('Launch error:', e);
                runningInstances.delete(instanceName);
                liveLogs.delete(instanceName);
                childProcesses.delete(instanceName);
                activeLaunches.delete(instanceName);
                mainWindow.webContents.send('instance:status', { instanceName, status: 'stopped' });
                try {
                    const discord = require('./discord');
                    discord.setActivity('In Launcher', 'Idle', 'minecraft', 'Minecraft');
                } catch (err) { /* ignore */ }
                return { success: false, error: e.message };
            }

            return { success: true };
        } catch (e) {
            console.error('Initial launch error:', e);
            activeLaunches.delete(instanceName);
            runningInstances.delete(instanceName);
            return { success: false, error: e.message };
        }
    });
};
