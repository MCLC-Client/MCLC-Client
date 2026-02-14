let DiscordRPC = null;
try {
    DiscordRPC = require('discord-rpc');
} catch (e) {
    // optional dependency not found - Discord RPC will be disabled
}

const clientId = '1469842361830866985';

let rpc;
let isReady = false;

const initRPC = async () => {
    if (!DiscordRPC) return;

    try {
        rpc = new DiscordRPC.Client({ transport: 'ipc' });

        rpc.on('ready', () => {
            console.log('Discord RPC Ready');
            isReady = true;
            setActivity('In Launcher', 'Idle');
        });

        await rpc.login({ clientId }).catch(console.error);
    } catch (e) {
        console.error('Failed to init Discord RPC', e);
    }
};

const setActivity = (details, state, largeImageKey = 'mclc_icon', largeImageText = 'MCLC', startTimestamp = null) => {
    if (!rpc || !isReady) return;

    rpc.setActivity({
        details,
        state,
        startTimestamp: startTimestamp || Date.now(),
        largeImageKey,
        largeImageText,
        instance: false,
    });
};

const clearActivity = () => {
    if (!rpc || !isReady) return;
    rpc.clearActivity();
};

module.exports = {
    initRPC,
    setActivity,
    clearActivity
};
