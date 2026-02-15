import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import LoadingOverlay from '../components/LoadingOverlay';

function ServerSettings() {
    const { addNotification } = useNotification();
    const [settings, setSettings] = useState({
        serverPath: '',
        backupPath: '',
        autoBackup: false,
        backupInterval: 24,
        maxBackups: 5,
        defaultMemory: '1024',
        defaultPort: '25565',
        defaultMaxPlayers: '20'
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const result = await window.electronAPI.getServerSettings();
            if (result.success) {
                setSettings(result.settings);
            }
        } catch (e) {
            addNotification('Failed to load settings', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await window.electronAPI.saveServerSettings(settings);
            if (result.success) {
                addNotification('Settings saved successfully', 'success');
            } else {
                addNotification(`Failed to save: ${result.error}`, 'error');
            }
        } catch (e) {
            addNotification(`Failed to save: ${e.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const selectFolder = async (key) => {
        const result = await window.electronAPI.selectFolder();
        if (result && !result.canceled && result.filePaths[0]) {
            handleChange(key, result.filePaths[0]);
        }
    };

    return (
        <div className="p-8 h-full overflow-y-auto custom-scrollbar">
            {isLoading && <LoadingOverlay message="Loading settings..." />}

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-1">Server Settings</h1>
                <p className="text-gray-400 text-sm">Configure global server settings</p>
            </div>

            <div className="space-y-6 max-w-2xl">
                {/* Paths */}
                <div className="bg-surface/40 backdrop-blur-sm border border-white/5 rounded-xl p-6">
                    <h2 className="text-lg font-bold text-white mb-4">Server Paths</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">
                                Server Directory
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={settings.serverPath}
                                    onChange={(e) => handleChange('serverPath', e.target.value)}
                                    className="flex-1 bg-background border border-white/10 rounded-xl px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                    placeholder="C:/MinecraftServers"
                                />
                                <button
                                    onClick={() => selectFolder('serverPath')}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition-colors"
                                >
                                    Browse
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">
                                Backup Directory
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={settings.backupPath}
                                    onChange={(e) => handleChange('backupPath', e.target.value)}
                                    className="flex-1 bg-background border border-white/10 rounded-xl px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                    placeholder="C:/Backups"
                                />
                                <button
                                    onClick={() => selectFolder('backupPath')}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition-colors"
                                >
                                    Browse
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Backup Settings */}
                <div className="bg-surface/40 backdrop-blur-sm border border-white/5 rounded-xl p-6">
                    <h2 className="text-lg font-bold text-white mb-4">Backup Settings</h2>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="autoBackup"
                                checked={settings.autoBackup}
                                onChange={(e) => handleChange('autoBackup', e.target.checked)}
                                className="w-4 h-4 accent-primary"
                            />
                            <label htmlFor="autoBackup" className="text-gray-300">
                                Enable automatic backups
                            </label>
                        </div>

                        {settings.autoBackup && (
                            <>
                                <div>
                                    <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">
                                        Backup Interval (hours)
                                    </label>
                                    <input
                                        type="number"
                                        value={settings.backupInterval}
                                        onChange={(e) => handleChange('backupInterval', parseInt(e.target.value))}
                                        className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                        min="1"
                                        max="168"
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">
                                        Max Backups to Keep
                                    </label>
                                    <input
                                        type="number"
                                        value={settings.maxBackups}
                                        onChange={(e) => handleChange('maxBackups', parseInt(e.target.value))}
                                        className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                        min="1"
                                        max="50"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Default Server Settings */}
                <div className="bg-surface/40 backdrop-blur-sm border border-white/5 rounded-xl p-6">
                    <h2 className="text-lg font-bold text-white mb-4">Default Server Settings</h2>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">
                                Default Memory (MB)
                            </label>
                            <input
                                type="number"
                                value={settings.defaultMemory}
                                onChange={(e) => handleChange('defaultMemory', e.target.value)}
                                className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                min="512"
                                step="512"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">
                                Default Port
                            </label>
                            <input
                                type="number"
                                value={settings.defaultPort}
                                onChange={(e) => handleChange('defaultPort', e.target.value)}
                                className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                min="1"
                                max="65535"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">
                                Default Max Players
                            </label>
                            <input
                                type="number"
                                value={settings.defaultMaxPlayers}
                                onChange={(e) => handleChange('defaultMaxPlayers', e.target.value)}
                                className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                min="1"
                                max="100"
                            />
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-primary hover:bg-primary-hover text-black font-bold px-8 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {isSaving && <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>}
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ServerSettings;