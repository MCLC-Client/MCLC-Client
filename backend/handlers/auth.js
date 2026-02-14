const { Auth, mcTokenToolbox } = require('msmc');
const Store = require('electron-store');
const store = new Store();

const authManager = new Auth('select_account');

module.exports = (ipcMain, mainWindow) => {
    ipcMain.handle('auth:login', async () => {
        try {
            const xboxManager = await authManager.launch('electron');
            const token = await xboxManager.getMinecraft();

            let name, uuid, accessToken;

            if (token.profile) {
                name = token.profile.name;
                uuid = token.profile.id;
                accessToken = token.mcToken || token.access_token;
            } else if (token.name && token.uuid) {
                name = token.name;
                uuid = token.uuid;
                accessToken = token.mcToken || token.access_token;
            } else {
                const mclcAuth = token.mclc ? token.mclc() : null;
                if (mclcAuth) {
                    name = mclcAuth.name;
                    uuid = mclcAuth.uuid;
                    accessToken = mclcAuth.access_token;
                } else {
                    throw new Error("Unable to parse authentication token");
                }
            }

            if (!name || !uuid || !accessToken) {
                throw new Error("Missing required auth fields");
            }

            // Save the refresh token for later use
            const refreshToken = xboxManager.save();

            const profile = {
                name,
                uuid,
                access_token: accessToken,
                refresh_token: refreshToken,
                exp: token.exp // Store the expiration time
            };

            // Manage multiple accounts
            let accounts = store.get('accounts') || [];
            const existingIndex = accounts.findIndex(a => a.uuid === uuid);
            if (existingIndex !== -1) {
                accounts[existingIndex] = profile;
            } else {
                accounts.push(profile);
            }

            store.set('accounts', accounts);
            store.set('user_profile', profile); // Set as current

            mainWindow.webContents.send('auth:success', { name, uuid });
            return { success: true, profile: { name, uuid } };
        } catch (e) {
            console.error("Login failed:", e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('auth:validate', async () => {
        const profile = store.get('user_profile');
        if (!profile || !profile.access_token) return { success: false, error: 'Not logged in' };

        try {
            // Check if current token is valid. Pass object with exp to avoid 'in' operator error on string
            const isLocalValid = mcTokenToolbox.validate({ exp: profile.exp });

            if (isLocalValid) {
                // Proactively check with Mojang to be 100% sure (helps with revoked tokens)
                try {
                    const axios = require('axios');
                    await axios.get('https://api.minecraftservices.com/minecraft/profile', {
                        headers: { Authorization: `Bearer ${profile.access_token}` },
                        timeout: 15000
                    });
                    return { success: true };
                } catch (e) {
                    if (e.response?.status === 401) {
                        console.log("Token locally valid but rejected by Mojang, needing refresh.");
                        // Fall through to refresh logic
                    } else {
                        // Network error or Mojang down? Assume valid for now if local check passed
                        return { success: true };
                    }
                }
            }

            // If not valid, try refreshing
            if (profile.refresh_token) {
                console.log("Session expired, attempting refresh for", profile.name);
                const xboxManager = await authManager.refresh(profile.refresh_token);
                const token = await xboxManager.getMinecraft();

                const newAccessToken = token.mcToken || token.access_token;
                const newRefreshToken = xboxManager.save();

                const updatedProfile = {
                    ...profile,
                    access_token: newAccessToken,
                    refresh_token: newRefreshToken,
                    exp: token.exp
                };

                // Update in accounts list
                let accounts = store.get('accounts') || [];
                const idx = accounts.findIndex(a => a.uuid === profile.uuid);
                if (idx !== -1) {
                    accounts[idx] = updatedProfile;
                    store.set('accounts', accounts);
                }

                // Update current
                store.set('user_profile', updatedProfile);
                console.log("Refresh successful for", profile.name);
                return { success: true, refreshed: true };
            }

            throw new Error("Session expired and no refresh token available");
        } catch (e) {
            console.error("Validation/Refresh failed:", e.message);
            // On failure, logout
            store.delete('user_profile');
            return { success: false, error: 'Session expired', loggedOut: true };
        }
    });

    ipcMain.handle('auth:get-profile', () => {
        return store.get('user_profile');
    });

    ipcMain.handle('auth:get-accounts', () => {
        const accounts = store.get('accounts') || [];
        // Return only public info
        return accounts.map(a => ({ name: a.name, uuid: a.uuid }));
    });

    ipcMain.handle('auth:switch-account', (_, uuid) => {
        const accounts = store.get('accounts') || [];
        const account = accounts.find(a => a.uuid === uuid);
        if (account) {
            store.set('user_profile', account);
            return { success: true, profile: { name: account.name, uuid: account.uuid } };
        }
        return { success: false, error: 'Account not found' };
    });

    ipcMain.handle('auth:remove-account', (_, uuid) => {
        let accounts = store.get('accounts') || [];
        accounts = accounts.filter(a => a.uuid !== uuid);
        store.set('accounts', accounts);

        // If removed the current one, logout
        const current = store.get('user_profile');
        if (current && current.uuid === uuid) {
            store.delete('user_profile');
            return { success: true, loggedOut: true };
        }
        return { success: true, loggedOut: false };
    });

    ipcMain.handle('auth:logout', () => {
        store.delete('user_profile');
        return { success: true };
    });
};
