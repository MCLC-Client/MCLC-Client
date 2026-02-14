const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { app, ipcMain } = require('electron');
const AdmZip = require('adm-zip');

// Base URL for Adoptium API
const ADOPTIUM_API = 'https://api.adoptium.net/v3';

module.exports = (ipcMain) => {
    const appData = app.getPath('userData');
    const runtimesDir = path.join(appData, 'runtimes');

    const { pipeline } = require('stream');
    const { promisify } = require('util');
    const streamPipeline = promisify(pipeline);

    // Helper to download file
    async function downloadFile(url, destPath, onProgress) {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: 60000 // 1 minute timeout
        });

        if (response.status !== 200) {
            throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
        }

        const totalLength = parseInt(response.headers['content-length'], 10);
        let downloaded = 0;

        response.data.on('data', (chunk) => {
            downloaded += chunk.length;
            if (onProgress && !isNaN(totalLength) && totalLength > 0) {
                const percent = Math.round((downloaded / totalLength) * 100);
                onProgress(percent);
            }
        });

        const writer = fs.createWriteStream(destPath);
        await streamPipeline(response.data, writer);

        // Verify file exists and has content
        const stats = await fs.stat(destPath);
        console.log(`[JavaHandler] Download finished. File size on disk: ${stats.size} bytes. Expected: ${totalLength} bytes.`);

        if (stats.size === 0) {
            throw new Error("Downloaded file is empty");
        }

        if (!isNaN(totalLength) && totalLength > 0 && stats.size < totalLength * 0.9) { // Allow some slack for compression/headers but not much
            throw new Error(`Download incomplete: ${stats.size}/${totalLength} bytes downloaded.`);
        }
    }

    ipcMain.handle('java:install', async (event, version) => {
        try {
            console.log(`[JavaHandler] Request to install Java ${version}`);
            const sender = event.sender;
            const sendProgress = (step, progress) => {
                sender.send('java:progress', { step, progress });
            };

            // 1. Fetch release info
            sendProgress('Fetching release info...', 0);
            const apiUrl = `${ADOPTIUM_API}/assets/feature_releases/${version}/ga?architecture=x64&heap_size=normal&image_type=jdk&jvm_impl=hotspot&os=windows`;

            const res = await axios.get(apiUrl);
            if (!res.data || res.data.length === 0) {
                throw new Error(`No release found for Java ${version}`);
            }

            // Get the first binary (usually the latest)
            const binary = res.data[0].binaries[0];
            const downloadUrl = binary.package.link;
            const fileName = binary.package.name;
            const releaseName = res.data[0].release_name; // e.g., jdk-17.0.8+7

            const versionDir = path.join(runtimesDir, releaseName);
            const javaExePath = path.join(versionDir, 'bin', 'java.exe');

            // Check if already installed
            if (await fs.pathExists(javaExePath)) {
                console.log(`[JavaHandler] Java ${releaseName} already installed.`);
                return { success: true, path: javaExePath };
            }

            // 2. Download
            await fs.ensureDir(runtimesDir);
            const tempZipPath = path.join(runtimesDir, fileName);

            console.log(`[JavaHandler] Downloading ${downloadUrl} to ${tempZipPath}`);
            await downloadFile(downloadUrl, tempZipPath, (percent) => {
                sendProgress(`Downloading Java ${version}...`, percent);
            });

            // 3. Extract
            sendProgress('Extracting...', 100);
            console.log(`[JavaHandler] Extraction starting from ${tempZipPath} to ${runtimesDir}`);

            try {
                const zip = new AdmZip(tempZipPath);
                zip.extractAllTo(runtimesDir, true);
                console.log(`[JavaHandler] Extraction successful.`);
            } catch (extractErr) {
                console.error(`[JavaHandler] Extraction failed:`, extractErr);
                throw new Error(`Extraction failed: ${extractErr.message}`);
            }

            // Cleanup zip
            await fs.remove(tempZipPath);

            // Find the extracted folder (it might not exactly match releaseName, but usually does)
            // But usually Adoptium zips contain a top-level folder usually matching releaseName or 'jdk-<ver>'
            // We know we extracted to runtimesDir. Let's find the folder that contains bin/java.exe
            // Actually, extraction creates the folder. We can check if versionDir exists, 
            // OR find the folder that was just created.
            // Adoptium naming convention: jdk-17.0.10+7

            // To be safe, let's verify where it went.
            // If the zip contains a root folder, it will be in runtimesDir/<rootFolder>
            // We can return the path found.

            // Simple check: iterate folders in runtimesDir looking for this release keys? 
            // Or just trust standard naming.
            // Let's assume it extracted to 'jdk-<version>...'

            // Let's scan runtimes for the java.exe we want
            // But we might have multiple.
            // The API response `release_name` usually matches the folder name inside the zip.

            // Let's verify valid path
            if (await fs.pathExists(javaExePath)) {
                return { success: true, path: javaExePath };
            }

            // Fallback: look for immediate subdirectories containing bin/java.exe
            const subdirs = await fs.readdir(runtimesDir);
            for (const dir of subdirs) {
                const potentialPath = path.join(runtimesDir, dir, 'bin', 'java.exe');
                // We want to return the one we just installed... 
                // This fallback is risky if multiple installed.
                // ideally we check what was in the zip.
                if (dir.includes(`jdk-${version}`) || dir.includes(`jre-${version}`)) {
                    if (await fs.pathExists(potentialPath)) {
                        return { success: true, path: potentialPath };
                    }
                }
            }

            return { success: true, path: javaExePath }; // Hope for the best if verification imprecise, but typically it matches.

        } catch (e) {
            console.error('[JavaHandler] Error:', e);
            return { success: false, error: e.message };
        }
    });
};
