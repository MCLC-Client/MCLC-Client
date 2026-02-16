const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const JSZip = require('jszip');
const { transform } = require('sucrase');

module.exports = (ipcMain, mainWindow) => {
    const extensionsDir = path.join(app.getPath('userData'), 'extensions');
    const configPath = path.join(app.getPath('userData'), 'extensions.json');

    // Ensure extensions directory exists
    fs.ensureDirSync(extensionsDir);

    // Helper: Load Config
    const loadConfig = async () => {
        try {
            if (await fs.pathExists(configPath)) {
                return await fs.readJson(configPath);
            }
        } catch (e) { console.error("Failed to load extensions config", e); }
        return { enabled: {} }; // { "extension-id": true/false }
    };

    // Helper: Save Config
    const saveConfig = async (config) => {
        try {
            await fs.writeJson(configPath, config, { spaces: 2 });
        } catch (e) { console.error("Failed to save extensions config", e); }
    };

    // List installed extensions
    ipcMain.handle('extensions:list', async () => {
        try {
            const dirs = await fs.readdir(extensionsDir);
            const extensions = [];
            const config = await loadConfig();

            for (const dir of dirs) {
                const manifestPath = path.join(extensionsDir, dir, 'manifest.json');
                if (await fs.pathExists(manifestPath)) {
                    try {
                        const manifest = await fs.readJson(manifestPath);
                        // Normalizing: ensure 'main' exists, fallback to 'entry'
                        if (!manifest.main && manifest.entry) {
                            manifest.main = manifest.entry;
                        }

                        // Determine enabled state (default to true if not set)
                        const isEnabled = config.enabled[dir] !== false;
                        
                        // Resolve Icon Path
                        let iconPath = null;
                        if (manifest.icon) {
                             iconPath = path.join(extensionsDir, dir, manifest.icon).replace(/\\/g, '/');
                        }

                        extensions.push({
                            id: dir,
                            ...manifest,
                            enabled: isEnabled,
                            iconPath: iconPath,
                            localPath: path.join(extensionsDir, dir).replace(/\\/g, '/')
                        });
                    } catch (e) {
                        console.error(`Failed to read manifest for extension ${dir}`, e);
                    }
                }
            }
            return { success: true, extensions };
        } catch (error) {
            console.error('Failed to list extensions:', error);
            return { success: false, error: error.message };
        }
    });

    // Toggle Extension
    ipcMain.handle('extensions:toggle', async (_, id, enabled) => {
        try {
            const config = await loadConfig();
            config.enabled[id] = enabled;
            await saveConfig(config);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Install extension from URL or local path
    ipcMain.handle('extensions:install', async (_, sourcePath) => {
        try {
            let buffer;
            if (sourcePath.startsWith('http')) {
                const response = await axios.get(sourcePath, { responseType: 'arraybuffer' });
                buffer = response.data;
            } else {
                buffer = await fs.readFile(sourcePath);
            }

            const zip = await JSZip.loadAsync(buffer);
            
            // 1. VALIDATION: Check for manifest.json
            const manifestFile = zip.file('manifest.json');
            if (!manifestFile) {
                return { success: false, error: 'Invalid extension: missing manifest.json' };
            }

            // 2. VALIDATION: Check for main.js (Strict Requirement)
            // We check if 'main.js' exists in the root of the zip
            if (!zip.file('main.js')) {
                 return { success: false, error: 'Invalid extension: missing main.js in root' };
            }

            const manifestContent = await manifestFile.async('text');
            const manifest = JSON.parse(manifestContent);
            
            if (!manifest.id) {
                 // Generate a safe ID from name
                 manifest.id = manifest.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
            }
            
            // Normalize entry point
            if (!manifest.main && manifest.entry) {
                manifest.main = manifest.entry;
            }

            const installPath = path.join(extensionsDir, manifest.id);
            await fs.ensureDir(installPath);

            // Extract and Transpile
            for (const filename of Object.keys(zip.files)) {
                if (zip.files[filename].dir) continue;
                
                const fileData = await zip.files[filename].async('nodebuffer');
                const destPath = path.join(installPath, filename);
                
                await fs.ensureDir(path.dirname(destPath));

                // Transpile JSX/TSX/JS files
                if (filename.endsWith('.jsx') || filename.endsWith('.tsx') || filename.endsWith('.js')) {
                    const code = fileData.toString('utf-8');
                    try {
                        const compiled = transform(code, { 
                            transforms: ['jsx', 'imports'],
                            filePath: filename
                        });
                        // Save as .js (overwrite if it was .js, or valid if .jsx)
                        const jsPath = destPath.replace(/\.(jsx|tsx)$/, '.js');
                        await fs.writeFile(jsPath, compiled.code);
                    } catch (e) {
                        console.error(`Failed to transpile ${filename}:`, e);
                        // Fallback: save original
                        await fs.writeFile(destPath, fileData);
                    }
                } else {
                    await fs.writeFile(destPath, fileData);
                }
            }

            // Enable by default on install
            const config = await loadConfig();
            config.enabled[manifest.id] = true;
            await saveConfig(config);

            return { success: true, id: manifest.id };
        } catch (error) {
            console.error('Failed to install extension:', error);
            return { success: false, error: error.message };
        }
    });

    // Remove extension
    ipcMain.handle('extensions:remove', async (_, extensionId) => {
        try {
            const targetPath = path.join(extensionsDir, extensionId);
            if (await fs.pathExists(targetPath)) {
                await fs.remove(targetPath);
                
                // Cleanup config
                const config = await loadConfig();
                delete config.enabled[extensionId];
                await saveConfig(config);

                return { success: true };
            }
            return { success: false, error: 'Extension not found' };
        } catch (error) {
            console.error('Failed to remove extension:', error);
            return { success: false, error: error.message };
        }
    });

    // Fetch Marketplace Data - REMOVED or Deprecated
    ipcMain.handle('extensions:fetch-marketplace', async () => {
        return { success: true, extensions: [] }; // Return empty, distinct from "Installed"
    });
};
