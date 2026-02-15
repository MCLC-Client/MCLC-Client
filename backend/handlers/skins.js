const { app, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const crypto = require('crypto');

module.exports = (ipcMain, mainWindow) => {
    console.log('[SkinsHandler] Initializing...');
    const appData = app.getPath('userData');
    const skinsDir = path.join(appData, 'skins');
    const skinManifestPath = path.join(skinsDir, 'skins.json');

    // Ensure skins directory exists
    fs.ensureDirSync(skinsDir);

    // Helpers
    async function getSkinManifest() {
        try {
            if (await fs.pathExists(skinManifestPath)) {
                return await fs.readJson(skinManifestPath);
            }
        } catch (e) {
            console.error('Failed to read skin manifest', e);
        }
        return { skins: [] };
    }

    async function saveSkinManifest(manifest) {
        try {
            await fs.writeJson(skinManifestPath, manifest, { spaces: 4 });
        } catch (e) {
            console.error('Failed to save skin manifest', e);
        }
    }

    // 1. Get Current Skin (from Mojang)
    ipcMain.handle('skin:get-current', async (_, token) => {
        try {
            if (!token) return { success: false, error: 'No token provided' };
            const { getCachedProfile, clearCache } = require('../utils/profileCache');
            const data = await getCachedProfile(token);

            const skins = data.skins || [];
            const currentSkin = skins.find(s => s.state === 'ACTIVE');

            if (currentSkin) {
                return {
                    success: true,
                    url: currentSkin.url,
                    variant: currentSkin.variant,
                    capes: data.capes || []
                };
            }
            return { success: false, error: 'No active skin found', capes: data.capes || [] };
        } catch (e) {
            console.error('Failed to fetch current skin:', e.response?.data || e.message);
            if (e.response?.status === 401) {
                return { success: false, error: 'Unauthorized', authError: true };
            }
            return { success: false, error: e.message };
        }
    });

    // 2. Upload Skin to Mojang
    ipcMain.handle('skin:upload', async (_, token, skinPath, variant = 'classic') => {
        try {
            if (!token) return { success: false, error: 'No token provided' };
            if (!await fs.pathExists(skinPath)) return { success: false, error: 'Skin file not found' };

            // Start multipart upload
            const FormData = require('form-data');
            const form = new FormData();
            form.append('variant', variant);
            form.append('file', fs.createReadStream(skinPath));

            const res = await axios.post('https://api.minecraftservices.com/minecraft/profile/skins', form, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...form.getHeaders()
                },
                timeout: 30000
            });


            const { clearCache } = require('../utils/profileCache');
            clearCache(token);

            return { success: true };
        } catch (e) {
            console.error('Failed to upload skin:', e.response?.data || e.message);
            if (e.response?.status === 401) {
                return { success: false, error: 'Unauthorized', authError: true };
            }
            return { success: false, error: e.response?.data?.errorMessage || e.message };
        }
    });

    // 2.1 Upload Skin from URL (for Default Skins)
    ipcMain.handle('skin:upload-from-url', async (_, token, skinUrl, variant = 'classic') => {
        try {
            if (!token) return { success: false, error: 'No token provided' };
            if (!skinUrl) return { success: false, error: 'No URL provided' };

            // Download the skin to a temp file
            const tempPath = path.join(app.getPath('temp'), `skin-${Date.now()}.png`);
            const writer = fs.createWriteStream(tempPath);

            const response = await axios({
                url: skinUrl,
                method: 'GET',
                responseType: 'stream',
                timeout: 30000
            });

            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // Upload to Mojang
            const FormData = require('form-data');
            const form = new FormData();
            form.append('variant', variant);
            form.append('file', fs.createReadStream(tempPath));

            await axios.post('https://api.minecraftservices.com/minecraft/profile/skins', form, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...form.getHeaders()
                }
            });


            // Cleanup
            fs.remove(tempPath).catch(console.error);

            const { clearCache } = require('../utils/profileCache');
            clearCache(token);

            return { success: true };
        } catch (e) {
            console.error('Failed to upload skin from URL:', e.response?.data || e.message);
            if (e.response?.status === 401) {
                return { success: false, error: 'Unauthorized', authError: true };
            }
            return { success: false, error: e.response?.data?.errorMessage || e.message };
        }
    });

    // 2.5 Set Active Cape
    ipcMain.handle('skin:set-cape', async (_, token, capeId) => {
        try {
            if (!token) return { success: false, error: 'No token provided' };

            if (capeId) {
                // Set/Show Cape
                await axios.put(
                    'https://api.minecraftservices.com/minecraft/profile/capes/active',
                    { capeId },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } else {
                // Hide Cape
                await axios.delete(
                    'https://api.minecraftservices.com/minecraft/profile/capes/active',
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
            return { success: true };
        } catch (e) {
            console.error('Failed to set cape:', e.response?.data || e.message);
            return { success: false, error: e.response?.data?.errorMessage || e.message };
        }
    });

    // 3. Save Local Skin (Import)
    ipcMain.handle('skin:save-local', async (_, filePath) => {
        try {
            // If filePath is not provided, open dialog
            let sourcePath = filePath;
            if (!sourcePath) {
                const { canceled, filePaths } = await dialog.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Images', extensions: ['png'] }]
                });
                if (canceled || filePaths.length === 0) return { success: false, error: 'Cancelled' };
                sourcePath = filePaths[0];
            }

            // Generate ID
            const fileBuffer = await fs.readFile(sourcePath);

            // Validation: Check dimensions
            const { nativeImage } = require('electron');
            const img = nativeImage.createFromBuffer(fileBuffer);
            const size = img.getSize();
            if (!((size.width === 64 && size.height === 64) || (size.width === 64 && size.height === 32))) {
                return { success: false, error: `Invalid skin dimensions: ${size.width}x${size.height}. Must be 64x64 or 64x32.` };
            }

            const hash = crypto.createHash('sha1').update(fileBuffer).digest('hex');
            const destPath = path.join(skinsDir, `${hash}.png`);

            await fs.copy(sourcePath, destPath);

            // Update manifest
            const manifest = await getSkinManifest();
            // Check if exists
            if (!manifest.skins.find(s => s.id === hash)) {
                manifest.skins.push({
                    id: hash,
                    path: destPath,
                    added: Date.now(),
                    name: path.basename(sourcePath, path.extname(sourcePath))
                });
                await saveSkinManifest(manifest);
            }

            // Return Base64 for immediate display
            const base64 = `data:image/png;base64,${fileBuffer.toString('base64')}`;
            return { success: true, skin: { id: hash, path: destPath, name: manifest.skins.find(s => s.id === hash).name, data: base64 } };
        } catch (e) {
            console.error('Failed to save local skin:', e);
            return { success: false, error: e.message };
        }
    });

    // 4. Get Local Skins
    ipcMain.handle('skin:get-local', async () => {
        try {
            const manifest = await getSkinManifest();
            // Verify files exist and load content
            const validSkins = [];
            for (const skin of manifest.skins) {
                if (await fs.pathExists(skin.path)) {
                    // Read file as base64
                    try {
                        const buffer = await fs.readFile(skin.path);
                        skin.data = `data:image/png;base64,${buffer.toString('base64')}`;
                        validSkins.push(skin);
                    } catch (e) {
                        console.error(`Failed to read skin file ${skin.path}`, e);
                    }
                }
            }
            // Update if any were removed
            if (validSkins.length !== manifest.skins.length) {
                manifest.skins = validSkins.map(s => ({ ...s, data: undefined })); // Don't save base64 to manifest
                await saveSkinManifest(manifest);
            }
            return validSkins;
        } catch (e) {
            console.error('Failed to get local skins:', e);
            return [];
        }
    });

    // 5. Delete Local Skin
    ipcMain.handle('skin:delete-local', async (_, id) => {
        try {
            const manifest = await getSkinManifest();
            const skinIndex = manifest.skins.findIndex(s => s.id === id);

            if (skinIndex !== -1) {
                const skin = manifest.skins[skinIndex];
                await fs.remove(skin.path);
                manifest.skins.splice(skinIndex, 1);
                await saveSkinManifest(manifest);
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // 6. Rename Local Skin
    ipcMain.handle('skin:rename-local', async (_, id, newName) => {
        try {
            const manifest = await getSkinManifest();
            const skin = manifest.skins.find(s => s.id === id);
            if (skin) {
                skin.name = newName;
                await saveSkinManifest(manifest);
                return { success: true };
            }
            return { success: false, error: 'Skin not found' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });
};
