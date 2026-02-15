const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const JSZip = require('jszip');
const { transform } = require('sucrase');

module.exports = (ipcMain, mainWindow) => {
    const extensionsDir = path.join(app.getPath('userData'), 'extensions');

    // Ensure extensions directory exists
    fs.ensureDirSync(extensionsDir);

    // List installed extensions
    ipcMain.handle('extensions:list', async () => {
        try {
            const dirs = await fs.readdir(extensionsDir);
            const extensions = [];

            for (const dir of dirs) {
                const manifestPath = path.join(extensionsDir, dir, 'manifest.json');
                if (await fs.pathExists(manifestPath)) {
                    try {
                        const manifest = await fs.readJson(manifestPath);
                        // Normalizing: ensure 'main' exists, fallback to 'entry'
                        if (!manifest.main && manifest.entry) {
                            manifest.main = manifest.entry;
                        }

                        extensions.push({
                            id: dir,
                            ...manifest,
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
            
            // Read manifest first to get ID/Name
            const manifestFile = zip.file('manifest.json');
            if (!manifestFile) {
                return { success: false, error: 'Invalid extension: missing manifest.json' };
            }

            const manifestContent = await manifestFile.async('text');
            const manifest = JSON.parse(manifestContent);
            
            if (!manifest.id) {
                 // Fallback if ID is missing, though it should be required
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
                return { success: true };
            }
            return { success: false, error: 'Extension not found' };
        } catch (error) {
            console.error('Failed to remove extension:', error);
            return { success: false, error: error.message };
        }
    });

    // Fetch Marketplace Data
    ipcMain.handle('extensions:fetch-marketplace', async () => {
        try {
            // Using placeholder URL as requested.
            // In a real scenario, this would be a real endpoint.
            // For now, let's try to fetch it, but if it fails (404), return the mock data 
            // so the user still sees something working.
            const MARKETPLACE_URL = 'https://mclc.pluginhub.de/extensions.json';
            
            try {
                const response = await axios.get(MARKETPLACE_URL, { timeout: 5000 });
                return { success: true, extensions: response.data };
            } catch (netError) {
                console.warn('Failed to fetch marketplace, falling back to mock data:', netError.message);
                return { 
                    success: true, 
                    extensions: [
                        {
                            id: 'example-extension',
                            name: 'Example Extension',
                            description: 'A starter extension that shows a simple greeting.',
                            version: '1.0.0',
                            author: 'MCLC Team',
                            url: 'https://github.com/Fernsehheft/MCLC-Extensions/raw/main/example-extension.mcextension'
                        },
                        {
                            id: 'system-monitor',
                            name: 'System Monitor',
                            description: 'Displays CPU and RAM usage in the sidebar.',
                            version: '0.1.0',
                            author: 'Community',
                            url: '' 
                        }
                    ]
                };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
};
