const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window Controls
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),

    // System
    openFileDialog: (options) => ipcRenderer.invoke('dialog:open-file', options),
    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

    // Auth
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    validateSession: () => ipcRenderer.invoke('auth:validate'),
    getProfile: () => ipcRenderer.invoke('auth:get-profile'),
    getAccounts: () => ipcRenderer.invoke('auth:get-accounts'),
    switchAccount: (uuid) => ipcRenderer.invoke('auth:switch-account', uuid),
    removeAccount: (uuid) => ipcRenderer.invoke('auth:remove-account', uuid),

    // Styling
    selectBackgroundMedia: () => ipcRenderer.invoke('settings:select-background'),
    deleteBackgroundMedia: (path) => ipcRenderer.invoke('settings:delete-background', path),

    openInstanceFolder: (name) => ipcRenderer.invoke('instance:open-folder', name),

    // Instance Details
    getMods: (instanceName) => ipcRenderer.invoke('instance:get-mods', instanceName),
    getResourcePacks: (instanceName) => ipcRenderer.invoke('instance:get-resourcepacks', instanceName),
    toggleMod: (instanceName, fileName) => ipcRenderer.invoke('instance:toggle-mod', instanceName, fileName),
    deleteMod: (instanceName, fileName) => ipcRenderer.invoke('instance:delete-mod', instanceName, fileName),
    getWorlds: (instanceName) => ipcRenderer.invoke('instance:get-worlds', instanceName),
    getLogFiles: (instanceName) => ipcRenderer.invoke('instance:get-log-files', instanceName),
    getLog: (instanceName, filename) => ipcRenderer.invoke('instance:get-log', instanceName, filename),

    // Launcher
    launchGame: (instanceName) => ipcRenderer.invoke('launcher:launch', instanceName),
    getLiveLogs: (instanceName) => ipcRenderer.invoke('launcher:get-live-logs', instanceName),
    getLiveLogs: (instanceName) => ipcRenderer.invoke('launcher:get-live-logs', instanceName),
    killGame: (instanceName) => ipcRenderer.invoke('launcher:kill', instanceName),
    abortLaunch: (instanceName) => ipcRenderer.invoke('launcher:abort-launch', instanceName),

    // Instances
    createInstance: (name, version, loader, icon, loaderVersion) => ipcRenderer.invoke('instance:create', { name, version, loader, icon, loaderVersion }),
    updateInstance: (name, config) => ipcRenderer.invoke('instance:update', name, config),
    updateInstanceConfig: (name, config) => ipcRenderer.invoke('instance:update', name, config),
    migrateInstance: (name, config) => ipcRenderer.invoke('instance:migrate', name, config),
    reinstallInstance: (name, type) => ipcRenderer.invoke('instance:reinstall', name, type),
    deleteInstance: (name) => ipcRenderer.invoke('instance:delete', name),
    renameInstance: (oldName, newName) => ipcRenderer.invoke('instance:rename', oldName, newName),
    duplicateInstance: (name) => ipcRenderer.invoke('instance:duplicate', name),
    exportInstance: (name) => ipcRenderer.invoke('instance:export', name),
    importInstance: () => ipcRenderer.invoke('instance:import'),
    importMrPack: () => ipcRenderer.invoke('instance:import-mrpack'),
    getInstances: () => ipcRenderer.invoke('instance:get-all'),
    searchModrinth: (query, facets, options) => ipcRenderer.invoke('modrinth:search', query, facets, options),
    installMod: (data) => ipcRenderer.invoke('modrinth:install', data),
    installLocalMod: (instanceName, filePath) => ipcRenderer.invoke('instance:install-local-mod', instanceName, filePath),
    getModVersions: (projectId, loaders, gameVersions) => ipcRenderer.invoke('modrinth:get-versions', projectId, loaders, gameVersions),

    // Data (Versions/Loaders)
    getVanillaVersions: () => ipcRenderer.invoke('data:get-vanilla-versions'),
    getLoaderVersions: (loader, mcVersion) => ipcRenderer.invoke('instance:get-loader-versions', loader, mcVersion),
    getSupportedGameVersions: (loader) => ipcRenderer.invoke('instance:get-supported-game-versions', loader),
    getLoaders: (mcVersion, loaderType) => ipcRenderer.invoke('data:get-loaders', mcVersion, loaderType),
    getNews: () => ipcRenderer.invoke('data:get-news'),
    installJava: (version) => ipcRenderer.invoke('java:install', version),
    openExternal: (url) => require('electron').shell.openExternal(url),

    // Skins
    getCurrentSkin: (token) => ipcRenderer.invoke('skin:get-current', token),
    uploadSkin: (token, skinPath, variant) => ipcRenderer.invoke('skin:upload', token, skinPath, variant),
    saveLocalSkin: (filePath) => ipcRenderer.invoke('skin:save-local', filePath),
    getLocalSkins: () => ipcRenderer.invoke('skin:get-local'),
    deleteLocalSkin: (id) => ipcRenderer.invoke('skin:delete-local', id),
    renameLocalSkin: (id, newName) => ipcRenderer.invoke('skin:rename-local', id, newName),

    // Events
    // Events
    onLaunchProgress: (callback) => {
        const subscription = (_event, value) => callback(value);
        ipcRenderer.on('launch:progress', subscription);
        return () => ipcRenderer.removeListener('launch:progress', subscription);
    },
    onLaunchLog: (callback) => {
        const subscription = (_event, value) => callback(value);
        ipcRenderer.on('launch:log', subscription);
        return () => ipcRenderer.removeListener('launch:log', subscription);
    },
    onInstanceStatus: (callback) => {
        const subscription = (_event, value) => callback(value);
        ipcRenderer.on('instance:status', subscription);
        return () => ipcRenderer.removeListener('instance:status', subscription);
    },
    onInstallProgress: (callback) => {
        const subscription = (_event, value) => callback(value);
        ipcRenderer.on('install:progress', subscription);
        return () => ipcRenderer.removeListener('install:progress', subscription);
    },
    onLoginSuccess: (callback) => {
        const subscription = (_event, value) => callback(value);
        ipcRenderer.on('auth:success', subscription);
        return () => ipcRenderer.removeListener('auth:success', subscription);
    },
    onThemeUpdated: (callback) => {
        const subscription = (_event, value) => callback(value);
        ipcRenderer.on('theme:updated', subscription);
        return () => ipcRenderer.removeListener('theme:updated', subscription);
    },
    onJavaProgress: (callback) => {
        const subscription = (_event, value) => callback(value);
        ipcRenderer.on('java:progress', subscription);
        return () => ipcRenderer.removeListener('java:progress', subscription);
    },
    onWindowStateChange: (callback) => {
        const subscription = (_event, value) => callback(value);
        ipcRenderer.on('window-state', subscription);
        return () => ipcRenderer.removeListener('window-state', subscription);
    },
});
