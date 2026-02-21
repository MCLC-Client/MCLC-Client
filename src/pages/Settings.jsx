import React, { useState, useEffect, useRef } from 'react';
import { useNotification } from '../context/NotificationContext';
import ToggleBox from '../components/ToggleBox';
import ConfirmationModal from '../components/ConfirmationModal';

function Settings() {
    const { addNotification } = useNotification();
    const [settings, setSettings] = useState({
        javaPath: '',
        javaArgs: '-Xmx4G',
        gameResolution: { width: 854, height: 480 },
        launcherTheme: 'dark',
        minimizeOnLaunch: true,
        quitOnGameExit: false,
        animationsExaggerated: false,
        copySettingsEnabled: false,
        copySettingsSourceInstance: '',
        minMemory: 1024,
        maxMemory: 4096,
        resolutionWidth: 854,
        resolutionHeight: 480,
        enableDiscordRPC: true,
        autoUploadLogs: true,
        showDisabledFeatures: false,
        optimization: true,
        enableAutoInstallMods: true,
        autoInstallMods: [],
        cloudBackupSettings: {
            enabled: false,
            provider: 'GOOGLE_DRIVE',
            autoRestore: false
        }
    });

    const [cloudStatus, setCloudStatus] = useState({
        GOOGLE_DRIVE: { loggedIn: false, user: null },
        DROPBOX: { loggedIn: false, user: null },
        ONEDRIVE: { loggedIn: false, user: null }
    });

    const [showSoftResetModal, setShowSoftResetModal] = useState(false);
    const [showFactoryResetModal, setShowFactoryResetModal] = useState(false);
    const [instances, setInstances] = useState([]);
    const [isInstallingJava, setIsInstallingJava] = useState(false);
    const [javaInstallProgress, setJavaInstallProgress] = useState(null);
    const [showJavaModal, setShowJavaModal] = useState(false);
    const [installedRuntimes, setInstalledRuntimes] = useState([]);
    const [autoInstallModsInput, setAutoInstallModsInput] = useState('');
    const [searchingAutoInstallMods, setSearchingAutoInstallMods] = useState(false);
    const [autoInstallModsSearchResults, setAutoInstallModsSearchResults] = useState([]);
    const [autoInstallModsMetadata, setAutoInstallModsMetadata] = useState({});
    const [autoInstallModsListSearch, setAutoInstallModsListSearch] = useState('');
    const hasUnsavedChanges = useRef(false);
    const initialSettingsRef = useRef(null);

    useEffect(() => {
        const cleanup = window.electronAPI.onJavaProgress((data) => {
            setJavaInstallProgress(data);
        });
        return cleanup;
    }, []);

    const handleInstallJava = async (version) => {
        setShowJavaModal(false);
        setIsInstallingJava(true);
        setJavaInstallProgress({ step: 'Starting...', progress: 0 });
        try {
            const result = await window.electronAPI.installJava(version);
            if (result.success) {
                handleChange('javaPath', result.path);
                addNotification(`Java ${version} installed successfully`, 'success');
                loadJavaRuntimes();
            } else {
                addNotification(`Failed to install Java: ${result.error}`, 'error');
            }
        } catch (e) {
            addNotification(`Error: ${e.message}`, 'error');
        } finally {
            setIsInstallingJava(false);
            setJavaInstallProgress(null);
        }
    };

    useEffect(() => {
        loadSettings();
        loadInstances();
        loadJavaRuntimes();
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges.current) {
                saveSettings(settings);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);

            if (hasUnsavedChanges.current) {
                saveSettings(settings, true);
            }
        };
    }, []);

    const loadInstances = async () => {
        const list = await window.electronAPI.getInstances();
        setInstances(list || []);
    };

    const loadJavaRuntimes = async () => {
        try {
            const res = await window.electronAPI.getJavaRuntimes();
            if (res.success) {
                setInstalledRuntimes(res.runtimes);
            }
        } catch (err) {
            console.error("Failed to load Java runtimes", err);
        }
    };

    const handleDeleteRuntime = async (dirPath) => {
        if (!confirm("Are you sure you want to delete this Java runtime?")) return;
        try {
            const res = await window.electronAPI.deleteJavaRuntime(dirPath);
            if (res.success) {
                addNotification("Java runtime deleted", "success");
                loadJavaRuntimes();
                // If the deleted runtime was selected, clear the selection?
                // Probably better to leave it and let user realize, or verify.
            } else {
                addNotification(`Failed to delete: ${res.error}`, "error");
            }
        } catch (e) {
            addNotification(`Error: ${e.message}`, "error");
        }
    };

    const loadSettings = async () => {
        const res = await window.electronAPI.getSettings();
        if (res.success) {
            const loadedSettings = {
                ...settings,
                ...res.settings,
                cloudBackupSettings: {
                    ...settings.cloudBackupSettings,
                    ...(res.settings.cloudBackupSettings || {})
                }
            };
            setSettings(loadedSettings);
            initialSettingsRef.current = loadedSettings;
        }
        loadCloudStatus();
    };

    const loadCloudStatus = async () => {
        try {
            const status = await window.electronAPI.cloudGetStatus();
            setCloudStatus(status);
        } catch (e) {
            console.error("Failed to load cloud status", e);
        }
    };

    const handleCloudLogin = async (providerId) => {
        try {
            const res = await window.electronAPI.cloudLogin(providerId);
            if (res.success) {
                addNotification(`Successfully logged into ${providerId.replace('_', ' ')}`, 'success');
                loadCloudStatus();
            } else {
                addNotification(`Login failed: ${res.error}`, 'error');
            }
        } catch (e) {
            addNotification(`Error: ${e.message}`, 'error');
        }
    };

    const handleCloudLogout = async (providerId) => {
        try {
            const res = await window.electronAPI.cloudLogout(providerId);
            if (res.success) {
                addNotification(`Logged out from ${providerId.replace('_', ' ')}`, 'success');
                loadCloudStatus();
            }
        } catch (e) {
            addNotification(`Error: ${e.message}`, 'error');
        }
    };

    const handleChange = (key, value) => {
        setSettings(prev => {
            const newSettings = { ...prev, [key]: value };
            if (initialSettingsRef.current) {
                const hasChanges = Object.keys(newSettings).some(
                    key => newSettings[key] !== initialSettingsRef.current[key]
                );
                hasUnsavedChanges.current = hasChanges;
            }
            saveSettings(newSettings, true);
            return newSettings;
        });
    };

    const saveSettings = async (newSettings, silent = false) => {
        const res = await window.electronAPI.saveSettings(newSettings);
        if (res.success) {

            initialSettingsRef.current = newSettings;
            hasUnsavedChanges.current = false;
            if (!silent) {
                addNotification('Settings saved successfully', 'success');
            }
        } else {
            addNotification('Failed to save settings', 'error');
        }
    };
    const handleUpdate = async (key, value) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);

        // Save to backend
        try {
            await window.electronAPI.saveSettings(newSettings);
            // addNotification('Settings saved', 'success'); // Optional: instant feedback
        } catch (error) {
            addNotification('Failed to save settings', 'error');
        }
    };

    const handleSoftReset = async () => {
        addNotification('Initiating Soft Reset...', 'info');
        await window.electronAPI.softReset();
    };

    const handleFactoryReset = async () => {
        addNotification('Initiating Factory Reset... Goodbye!', 'error');
        await window.electronAPI.factoryReset();
    };

    const handleBrowseJava = async () => {
        const result = await window.electronAPI.openFileDialog({
            properties: ['openFile'],
            filters: [{ name: 'Java Executable', extensions: ['exe', 'bin'] }]
        });

        // Check if user canceled the dialog
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
            return; // Don't update the state if canceled
        }

        // Extract the file path string
        const selectedPath = result.filePaths[0];

        // Optional: Validate that it's a Java executable
        if (selectedPath && (selectedPath.toLowerCase().endsWith('.exe') || selectedPath.toLowerCase().endsWith('.bin'))) {
            handleChange('javaPath', selectedPath);
        } else {
            addNotification('Please select a valid Java executable (javaw.exe or java)', 'error');
        }
    };
    const handleManualSave = () => {
        saveSettings(settings, false);
    };

    const addAutoInstallMod = async () => {
        const input = autoInstallModsInput.trim();
        if (!input) {
            addNotification('Please enter a Modrinth ID or search term', 'error');
            return;
        }

        // Check if it's already in the list
        if (settings.autoInstallMods.includes(input)) {
            addNotification('This mod is already in the list', 'warning');
            setAutoInstallModsInput('');
            return;
        }

        // Try to get mod name from search results or API
        let modName = input;
        const foundInSearch = autoInstallModsSearchResults.find(m => m.project_id === input);
        if (foundInSearch) {
            modName = foundInSearch.title;
        } else {
            // Try to fetch from API
            try {
                const response = await fetch(`https://api.modrinth.com/v2/project/${input}`);
                if (response.ok) {
                    const data = await response.json();
                    modName = data.title;
                }
            } catch (err) {
                console.error('Failed to fetch mod details:', err);
            }
        }

        // Add the mod
        const newAutoInstallMods = [...(settings.autoInstallMods || []), input];
        handleChange('autoInstallMods', newAutoInstallMods);
        setAutoInstallModsMetadata(prev => ({ ...prev, [input]: modName }));
        setAutoInstallModsInput('');
        setAutoInstallModsSearchResults([]);
        addNotification('Mod added to Auto Install Mods', 'success');
    };

    const removeAutoInstallMod = (modId) => {
        const newAutoInstallMods = (settings.autoInstallMods || []).filter(m => m !== modId);
        handleChange('autoInstallMods', newAutoInstallMods);
        setAutoInstallModsMetadata(prev => {
            const newMetadata = { ...prev };
            delete newMetadata[modId];
            return newMetadata;
        });
        addNotification('Mod removed from Auto Install Mods', 'success');
    };

    const searchModrinthMod = async (query) => {
        if (!query.trim()) {
            setAutoInstallModsSearchResults([]);
            return;
        }

        setSearchingAutoInstallMods(true);
        try {
            const response = await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=5`);
            const data = await response.json();
            setAutoInstallModsSearchResults(data.hits || []);
        } catch (err) {
            console.error('Failed to search mods:', err);
            addNotification('Failed to search Modrinth', 'error');
            setAutoInstallModsSearchResults([]);
        } finally {
            setSearchingAutoInstallMods(false);
        }
    };

    return (
        <div className="p-10 text-white h-full overflow-y-auto custom-scrollbar">
            <h1 className="text-3xl font-bold mb-2">Settings</h1>
            <p className="text-gray-400 mb-10">Manage your launcher preferences.</p>

            {/* Save Button */}
            <div className="max-w-3xl mb-6 flex justify-end">
                <button
                    onClick={handleManualSave}
                    className="px-6 py-2 bg-primary hover:bg-primary-hover rounded-lg text-sm font-medium transition flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    <span>Save Settings</span>
                </button>
            </div>

            <div className="space-y-6 max-w-3xl">
                {/* General Section */}
                <div className="bg-surface/50 p-8 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                    <h2 className="text-lg font-bold mb-6 text-white">General</h2>

                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-white">Startup Page</div>
                            <div className="text-sm text-gray-500 mt-1">Choose which page to show when you open the app</div>
                        </div>
                        <select
                            value={settings.startPage || 'dashboard'}
                            onChange={(e) => handleChange('startPage', e.target.value)}
                            className="bg-background border border-white/10 rounded-xl px-4 pr-10 py-2.5 text-sm focus:border-primary outline-none text-gray-300 cursor-pointer min-w-[180px]"
                        >
                            <option value="dashboard">Dashboard</option>
                            <option value="library">Library</option>
                        </select>
                    </div>
                </div>

                {/* Java Modal */}
                {showJavaModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                        <div className="bg-[#151515] p-6 rounded-2xl border border-white/10 w-96 shadow-2xl animate-scale-in">
                            <h3 className="text-xl font-bold mb-4">Install Java</h3>
                            <p className="text-gray-400 mb-6 text-sm">Select a Java version to install. We recommend Java 17 for most modern versions (1.18+).</p>

                            <div className="space-y-3">
                                {[8, 17, 21].map(v => (
                                    <button
                                        key={v}
                                        onClick={() => handleInstallJava(v)}
                                        className="w-full p-4 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 transition flex items-center justify-between group"
                                    >
                                        <span className="font-medium">Java {v} (LTS)</span>
                                        <span className="text-primary opacity-0 group-hover:opacity-100 transition">Install &rarr;</span>
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setShowJavaModal(false)}
                                className="mt-6 w-full py-2 text-sm text-gray-400 hover:text-white transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Java Runtime Section */}
                <div className="bg-surface/50 p-8 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                    <h2 className="text-lg font-bold mb-6 text-white">Java Runtime</h2>

                    <div className="mb-4">
                        <label className="block text-gray-400 text-sm font-medium mb-2">Java Executable Path</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={settings.javaPath || ''}
                                readOnly
                                placeholder="Detecting..."
                                className="flex-1 bg-black/20 border border-white/5 rounded-lg px-4 py-2 text-sm text-gray-300 focus:outline-none focus:border-primary/50"
                            />
                            <button
                                onClick={handleBrowseJava}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition border border-white/5"
                            >
                                Browse
                            </button>
                            <button
                                onClick={() => setShowJavaModal(true)}
                                disabled={isInstallingJava}
                                className={`px-4 py-2 bg-primary hover:bg-primary-hover rounded-lg text-sm font-medium transition flex items-center gap-2 ${isInstallingJava ? 'opacity-50 cursor-wait' : ''}`}
                            >
                                {isInstallingJava ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>{javaInstallProgress ? `${Math.round(javaInstallProgress.progress)}%` : 'Installing...'}</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        <span>Install Java</span>
                                    </>
                                )}
                            </button>
                        </div>
                        {isInstallingJava && javaInstallProgress && (
                            <div className="mt-2 text-xs text-primary/80 animate-pulse">
                                {javaInstallProgress.step}
                            </div>
                        )}
                        <p className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                            <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Recommended: Leave empty to use bundled Java. Install specific version if needed.
                        </p>
                    </div>

                    {/* Installed Runtimes List */}
                    {installedRuntimes.length > 0 && (
                        <div className="mt-6 border-t border-white/5 pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-gray-300">Installed Versions</h3>
                                <button
                                    onClick={() => window.electronAPI.openJavaFolder()}
                                    className="text-xs text-primary hover:text-primary-hover transition"
                                >
                                    Open Folder
                                </button>
                            </div>

                            <div className="space-y-2">
                                {installedRuntimes.map((runtime) => (
                                    <div key={runtime.dirPath} className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5 group hover:border-white/10 transition">
                                        <div className="flex-1 min-w-0 mr-4">
                                            <div className="text-sm font-medium text-gray-200 truncate">{runtime.name}</div>
                                            <div className="text-xs text-gray-500 truncate font-mono mt-0.5">{runtime.path}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {settings.javaPath === runtime.path ? (
                                                <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded border border-green-500/20">Active</span>
                                            ) : (
                                                <button
                                                    onClick={() => handleChange('javaPath', runtime.path)}
                                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-xs rounded transition border border-white/5 hover:border-white/10"
                                                >
                                                    Select
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDeleteRuntime(runtime.dirPath)}
                                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition"
                                                title="Delete Runtime"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Memory Allocation Section */}
                <div className="bg-surface/50 p-8 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                    <h2 className="text-lg font-bold mb-6 text-white">Memory Allocation</h2>

                    <div className="grid grid-cols-2 gap-8 mb-6">
                        <div>
                            <label className="block text-gray-400 text-sm font-medium mb-2">Minimum (MB)</label>
                            <input
                                type="number"
                                value={settings.minMemory}
                                onChange={(e) => handleChange('minMemory', parseInt(e.target.value) || 0)}
                                className="w-full bg-background border border-white/10 rounded-xl p-3 text-sm focus:border-primary outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm font-medium mb-2">Maximum (MB)</label>
                            <input
                                type="number"
                                value={settings.maxMemory}
                                onChange={(e) => handleChange('maxMemory', parseInt(e.target.value) || 0)}
                                className="w-full bg-background border border-white/10 rounded-xl p-3 text-sm focus:border-primary outline-none font-mono"
                            />
                        </div>
                    </div>
                    <div>
                        <input
                            type="range"
                            min="512"
                            max="16384"
                            step="512"
                            value={settings.maxMemory}
                            onChange={(e) => handleChange('maxMemory', parseInt(e.target.value))}
                            className="w-full h-1.5 bg-background-dark rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-2 font-mono">
                            <span>512 MB</span>
                            <span className="text-primary font-bold">{Math.floor(settings.maxMemory / 1024 * 10) / 10} GB</span>
                            <span>16 GB</span>
                        </div>
                    </div>
                </div>

                {/* Resolution Section */}
                <div className="bg-surface/50 p-8 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                    <h2 className="text-lg font-bold mb-6 text-white">Resolution</h2>

                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <label className="block text-gray-400 text-sm font-medium mb-2">Width</label>
                            <input
                                type="number"
                                value={settings.resolutionWidth}
                                onChange={(e) => handleChange('resolutionWidth', parseInt(e.target.value) || 0)}
                                className="w-full bg-background border border-white/10 rounded-xl p-3 text-sm focus:border-primary outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm font-medium mb-2">Height</label>
                            <input
                                type="number"
                                value={settings.resolutionHeight}
                                onChange={(e) => handleChange('resolutionHeight', parseInt(e.target.value) || 0)}
                                className="w-full bg-background border border-white/10 rounded-xl p-3 text-sm focus:border-primary outline-none font-mono"
                            />
                        </div>
                    </div>
                </div>

                {/* Instance Creation Section */}
                <div className="bg-surface/50 p-8 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                    <h2 className="text-lg font-bold mb-6 text-white">Instance Creation</h2>

                    <ToggleBox
                        checked={settings.copySettingsEnabled || false}
                        onChange={(val) => handleChange('copySettingsEnabled', val)}
                        label="Copy Settings from Instance"
                        description="Automatically copy keybinds and options from a selected instance when creating a new one."
                    />

                    {settings.copySettingsEnabled && (
                        <div>
                            <label className="block text-gray-400 text-sm font-medium mb-2">Source Instance</label>
                            <select
                                value={settings.copySettingsSourceInstance || ''}
                                onChange={(e) => handleChange('copySettingsSourceInstance', e.target.value)}
                                className="w-full bg-background border border-white/10 rounded-xl p-3 text-sm focus:border-primary outline-none font-mono text-gray-300"
                            >
                                <option value="">Select an instance...</option>
                                {instances.map((inst) => (
                                    <option key={inst.name} value={inst.name}>{inst.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Launcher Integration Section */}
                <div className="bg-surface/50 p-8 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                    <h2 className="text-lg font-bold mb-6 text-white">Launcher Integration</h2>

                    <ToggleBox
                        checked={settings.enableDiscordRPC}
                        onChange={(val) => handleChange('enableDiscordRPC', val)}
                        label="Discord Rich Presence"
                        description="Show what you're playing on Discord"
                    />
                    <ToggleBox
                        className="mt-4 pt-4 border-t border-white/5"
                        checked={settings.autoUploadLogs || false}
                        onChange={(val) => handleChange('autoUploadLogs', val)}
                        label="Auto-upload logs on crash"
                        description="Automatically upload logs to mclo.gs if the game crashes"
                    />
                    <ToggleBox
                        className="mt-6 pt-6 border-t border-white/5"
                        checked={settings.showDisabledFeatures || false}
                        onChange={(val) => handleChange('showDisabledFeatures', val)}
                        label="Show Disabled Features"
                        description="Hides or grays out features that are currently disabled (like the Extensions button)."
                    />
                    <ToggleBox
                        className="mt-4 pt-4 border-t border-white/5"
                        checked={settings.optimization || false}
                        onChange={(val) => handleChange('optimization', val)}
                        label="Enable Optimization"
                        description="Automatically install performance optimization mods when creating a new instance."
                    />
                    <ToggleBox
                        className="mt-4 pt-4 border-t border-white/5"
                        checked={settings.enableAutoInstallMods || false}
                        onChange={(val) => handleChange('enableAutoInstallMods', val)}
                        label="Enable Auto Install Mods"
                        description="Automatically install selected mods when creating a new instance. Unavailable mods for specific versions will be skipped."
                    />
                </div>

                {/* Auto Install Mods Management Section */}
                {settings.enableAutoInstallMods && (
                    <div className="bg-surface/50 p-8 rounded-2xl border border-white/5 hover:border-white/10 transition-colors mt-6">
                        <h2 className="text-lg font-bold mb-6 text-white">Auto Install Mods Management</h2>
                        <p className="text-sm text-gray-400 mb-4">Add mods by entering their Modrinth ID or searching by name. These mods will be automatically installed in every new instance.</p>

                        {/* Search / Add Input */}
                        <div className="mb-6">
                            <label className="block text-gray-400 text-sm font-medium mb-2">Add Auto Install Mod</label>
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={autoInstallModsInput}
                                    onChange={(e) => {
                                        setAutoInstallModsInput(e.target.value);
                                        if (e.target.value.trim()) {
                                            searchModrinthMod(e.target.value);
                                        } else {
                                            setAutoInstallModsSearchResults([]);
                                        }
                                    }}
                                    placeholder="Enter Modrinth ID or search mod name..."
                                    className="flex-1 bg-black/20 border border-white/5 rounded-lg px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-primary/50"
                                    onKeyPress={(e) => e.key === 'Enter' && addAutoInstallMod()}
                                />
                                <button
                                    onClick={addAutoInstallMod}
                                    className="px-4 py-2 bg-primary hover:bg-primary-hover rounded-lg text-sm font-medium transition"
                                >
                                    Add
                                </button>
                            </div>

                            {/* Search Results */}
                            {autoInstallModsSearchResults.length > 0 && (
                                <div className="bg-black/20 border border-white/10 rounded-lg overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                                    {autoInstallModsSearchResults.map((mod) => (
                                        <button
                                            key={mod.project_id}
                                            onClick={() => {
                                                setAutoInstallModsInput(mod.project_id);
                                                setAutoInstallModsSearchResults([]);
                                            }}
                                            className="w-full text-left px-4 py-2 hover:bg-white/10 transition border-b border-white/5 last:border-b-0"
                                        >
                                            <div className="font-medium text-sm text-white">{mod.title}</div>
                                            <div className="text-xs text-gray-500 truncate">{mod.project_id}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Current Auto Install Mods List */}
                        {(settings.autoInstallMods || []).length > 0 ? (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-gray-400 text-sm font-medium">Auto Install Mods ({settings.autoInstallMods.length})</label>
                                </div>
                                <input
                                    type="text"
                                    value={autoInstallModsListSearch}
                                    onChange={(e) => setAutoInstallModsListSearch(e.target.value)}
                                    placeholder="Search mods in list..."
                                    className="w-full mb-3 bg-black/20 border border-white/5 rounded-lg px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-primary/50"
                                />
                                <div className="space-y-2">
                                    {(settings.autoInstallMods || []).filter((mod) => {
                                        const modName = autoInstallModsMetadata[mod] || mod;
                                        const searchQuery = autoInstallModsListSearch.toLowerCase();
                                        return modName.toLowerCase().includes(searchQuery) || mod.toLowerCase().includes(searchQuery);
                                    }).map((mod) => (
                                        <div key={mod} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-lg px-4 py-3">
                                            <div>
                                                <div className="text-sm text-white font-medium">{autoInstallModsMetadata[mod] || mod}</div>
                                                <code className="text-xs text-gray-500 font-mono">{mod}</code>
                                            </div>
                                            <button
                                                onClick={() => removeAutoInstallMod(mod)}
                                                className="px-3 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded border border-red-500/20 transition"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                    {autoInstallModsListSearch && (settings.autoInstallMods || []).filter((mod) => {
                                        const modName = autoInstallModsMetadata[mod] || mod;
                                        const searchQuery = autoInstallModsListSearch.toLowerCase();
                                        return modName.toLowerCase().includes(searchQuery) || mod.toLowerCase().includes(searchQuery);
                                    }).length === 0 && (
                                            <div className="text-center py-4 text-gray-500 text-sm">No mods match your search.</div>
                                        )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 bg-black/20 border border-white/5 rounded-lg">
                                <p className="text-gray-500 text-sm">No auto install mods added yet. Add some to get started!</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Cloud Backup Section */}
                <div className="bg-surface/50 p-8 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                    <h2 className="text-lg font-bold mb-6 text-white flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                        </svg>
                        Cloud Backup
                    </h2>

                    <p className="text-sm text-gray-400 mb-6">Backup your worlds and instances to your favorite cloud storage. Access them from anywhere and restore them easily if something goes wrong.</p>

                    <div className="space-y-6">
                        {/* Provider Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { id: 'GOOGLE_DRIVE', name: 'Google Drive', icon: 'M12 2L2 20h20L12 2z' },
                                { id: 'DROPBOX', name: 'Dropbox', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5-10 5z' }
                            ].map((provider) => (
                                <div key={provider.id} className={`p-4 rounded-xl border transition-all ${cloudStatus[provider.id]?.loggedIn ? 'bg-primary/5 border-primary/20' : 'bg-black/20 border-white/5 hover:border-white/10'}`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={provider.icon} />
                                                </svg>
                                            </div>
                                            <span className="font-bold text-sm">{provider.name}</span>
                                        </div>
                                        {cloudStatus[provider.id]?.loggedIn && (
                                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                        )}
                                    </div>

                                    {cloudStatus[provider.id]?.loggedIn ? (
                                        <div className="space-y-3">
                                            <div className="text-xs text-gray-400">
                                                <div className="font-medium text-white truncate">{cloudStatus[provider.id].user?.name}</div>
                                                <div className="truncate">{cloudStatus[provider.id].user?.email}</div>
                                            </div>
                                            <button
                                                onClick={() => handleCloudLogout(provider.id)}
                                                className="w-full py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded border border-red-500/10 transition"
                                            >
                                                Logout
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleCloudLogin(provider.id)}
                                            className="w-full py-2 text-xs bg-primary hover:bg-primary-hover text-white rounded font-medium transition"
                                        >
                                            Login
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Cloud Backup Settings */}
                        <div className="pt-6 border-t border-white/5 space-y-4">
                            <ToggleBox
                                checked={settings.cloudBackupSettings?.enabled || false}
                                onChange={(val) => handleChange('cloudBackupSettings', { ...settings.cloudBackupSettings, enabled: val })}
                                label="Enable Cloud Backup"
                                description="Automatically upload backups to the cloud after local creation."
                            />

                            {settings.cloudBackupSettings?.enabled && (
                                <div className="ml-10 space-y-4 animate-slide-down">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-medium text-white">Default Provider</div>
                                            <div className="text-xs text-gray-500">The cloud service used for automatic backups</div>
                                        </div>
                                        <select
                                            value={settings.cloudBackupSettings?.provider || 'GOOGLE_DRIVE'}
                                            onChange={(e) => handleChange('cloudBackupSettings', { ...settings.cloudBackupSettings, provider: e.target.value })}
                                            className="bg-background border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:border-primary outline-none text-gray-300 cursor-pointer"
                                        >
                                            <option value="GOOGLE_DRIVE">Google Drive</option>
                                            <option value="DROPBOX">Dropbox</option>
                                        </select>
                                    </div>

                                    <ToggleBox
                                        checked={settings.cloudBackupSettings?.autoRestore || false}
                                        onChange={(val) => handleChange('cloudBackupSettings', { ...settings.cloudBackupSettings, autoRestore: val })}
                                        label="Auto-restore from Cloud"
                                        description="Automatically check for and download missing backups from the cloud."
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Maintenance Section */}
            <div className="bg-surface/50 px-8 py-6 rounded-2xl border border-white/5 mt-6 hover:border-white/10 transition-colors">
                <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    Maintenance & Reset
                </h2>

                <div className="space-y-6">
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-primary mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <div>
                                <h3 className="font-bold text-gray-200 text-sm">Troubleshooting Tools</h3>
                                <p className="text-xs text-gray-400 mt-1">Use these options if the application is behaving unexpectedly or if you want to clear your data.</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col justify-between h-auto min-h-[140px]">
                            <div>
                                <h3 className="font-bold text-white text-sm">Soft Reset</h3>
                                <p className="text-xs text-gray-500 mt-2">
                                    Resets all settings, themes, and caches.
                                    <span className="block mt-1 text-primary font-bold">✓ Keeps your Instances & Worlds</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setShowSoftResetModal(true)}
                                className="mt-4 w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm font-bold transition-colors"
                            >
                                Soft Reset
                            </button>
                        </div>

                        <div className="bg-red-500/5 rounded-xl p-4 border border-red-500/20 flex flex-col justify-between h-auto min-h-[140px]">
                            <div>
                                <h3 className="font-bold text-red-400 text-sm">Factory Reset</h3>
                                <p className="text-xs text-gray-500 mt-2">
                                    Completely wipes the application data.
                                    <span className="block mt-1 text-red-400 font-bold">⚠ Deletes EVERYTHING</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setShowFactoryResetModal(true)}
                                className="mt-4 w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 py-2 rounded-lg text-sm font-bold transition-colors border border-red-500/20"
                            >
                                Factory Reset
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Soft Reset Modal */}
            {showSoftResetModal && (
                <ConfirmationModal
                    title="Soft Reset Application?"
                    message="This will reset your themes, settings, and accounts. Your Minecraft instances and worlds will be SAFE. The application will restart."
                    confirmText="Soft Reset"
                    isDangerous={false}
                    onConfirm={handleSoftReset}
                    onCancel={() => setShowSoftResetModal(false)}
                />
            )}

            {/* Factory Reset Modal */}
            {showFactoryResetModal && (
                <ConfirmationModal
                    title="⚠ FACTORY RESET ⚠"
                    message="Are you sure? This will DELETE EVERYTHING including all instances, worlds, and settings. This action cannot be undone."
                    confirmText="DELETE EVERYTHING"
                    isDangerous={true}
                    onConfirm={handleFactoryReset}
                    onCancel={() => setShowFactoryResetModal(false)}
                />
            )}
        </div>
    );
}

export default Settings;