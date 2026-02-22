const path = require('path');
const fs = require('fs/promises');

exports.activate = async (api) => {
    const instancesDir = path.join(api.app.getPath('userData'), 'instances');

    // Register a custom IPC handler for the backend
    api.ipc.handle('set-instance-icon', async (event, { instanceName, iconData }) => {
        try {
            const configPath = path.join(instancesDir, instanceName, 'instance.json');
            try {
                // Check if file exists by trying to access it
                await fs.access(configPath);

                // Read and parse
                const fileContent = await fs.readFile(configPath, 'utf8');
                const config = JSON.parse(fileContent);

                // Update icon
                config.icon = iconData;

                // Write back
                await fs.writeFile(configPath, JSON.stringify(config, null, 4), 'utf8');
                return { success: true };
            } catch (err) {
                if (err.code === 'ENOENT') {
                    return { success: false, error: 'Instance not found' };
                }
                throw err;
            }
        } catch (e) {
            console.error(`[IconPicker:Backend] Failed to set icon for ${instanceName}:`, e);
            return { success: false, error: e.message };
        }
    });

    console.log(`[IconPicker:Backend] Activated for ${api.id}`);
};

exports.deactivate = () => {
    console.log("[IconPicker:Backend] Deactivated");
};
