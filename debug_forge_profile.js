const axios = require('axios');

const FORGE_META = 'https://meta.modrinth.com/forge/v0';
const MC_VERSION = '1.20.2';

async function run() {
    try {
        console.log('Fetching Forge manifest...');
        const manifestRes = await axios.get(`${FORGE_META}/manifest.json`);
        const manifest = manifestRes.data;

        const gameVersion = manifest.gameVersions.find(gv => gv.id === MC_VERSION);
        if (!gameVersion) {
            console.error('MC Version not found');
            return;
        }

        console.log('Found game version. Loaders:', gameVersion.loaders.length);
        const loader = gameVersion.loaders[0]; // Latest
        console.log('Selected Loader:', loader.id);
        console.log('Profile URL:', loader.url);

        const profileRes = await axios.get(loader.url);
        const profile = profileRes.data;

        console.log('--- Profile JSON ---');
        console.log(JSON.stringify(profile, null, 2));

    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
