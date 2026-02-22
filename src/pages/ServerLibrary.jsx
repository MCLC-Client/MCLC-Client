import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../context/NotificationContext';
import LoadingOverlay from '../components/LoadingOverlay';

function ServerLibrary() {
    const { t } = useTranslation();
    const { addNotification } = useNotification();
    const [platforms, setPlatforms] = useState([]);
    const [selectedPlatform, setSelectedPlatform] = useState(null);
    const [versions, setVersions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingVersions, setIsLoadingVersions] = useState(false);
    const [downloading, setDownloading] = useState(null);
    const [installedSoftware, setInstalledSoftware] = useState({});

    const platformDetails = {
        vanilla: { icon: '🌱', name: 'Vanilla', description: 'Official Minecraft server', color: 'from-green-500/20' },
        bukkit: { icon: '🔨', name: 'Bukkit', description: 'Original plugin API', color: 'from-orange-500/20' },
        spigot: { icon: '⚙️', name: 'Spigot', description: 'Most popular server software', color: 'from-yellow-500/20' },
        paper: { icon: '📄', name: 'Paper', description: 'High-performance fork of Spigot', color: 'from-blue-500/20' },
        purpur: { icon: '💜', name: 'Purpur', description: 'Fork of Paper with many features', color: 'from-purple-500/20' },
        folia: { icon: '🍃', name: 'Folia', description: 'Regionized multithreaded server', color: 'from-emerald-500/20' },
        forge: { icon: '⚒️', name: 'Forge', description: 'Modded server for Forge mods', color: 'from-red-500/20' },
        fabric: { icon: '🧵', name: 'Fabric', description: 'Lightweight modding platform', color: 'from-cyan-500/20' },
        neoforge: { icon: '🆕', name: 'NeoForge', description: 'Modern fork of Forge', color: 'from-indigo-500/20' },
        quilt: { icon: '🧩', name: 'Quilt', description: 'Community-driven modding platform', color: 'from-pink-500/20' }
    };

    useEffect(() => {
        loadPlatforms();
        loadInstalledSoftware();
    }, []);

    const loadPlatforms = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('https://mcutils.com/api/server-jars');
            const data = await response.json();
            const supportedPlatforms = ['vanilla', 'bukkit', 'spigot', 'paper', 'purpur', 'folia', 'forge', 'fabric', 'neoforge', 'quilt'];
            const filteredPlatforms = data.filter(p => supportedPlatforms.includes(p.key));
            const sortedPlatforms = filteredPlatforms.sort((a, b) => supportedPlatforms.indexOf(a.key) - supportedPlatforms.indexOf(b.key));

            setPlatforms(sortedPlatforms);
        } catch (error) {
            console.error('Failed to load platforms:', error);
            addNotification(t('server_library.load_platforms_failed'), 'error');
            // Fallback
            setPlatforms([
                { key: 'vanilla', name: 'Vanilla' },
                { key: 'bukkit', name: 'Bukkit' },
                { key: 'spigot', name: 'Spigot' },
                { key: 'paper', name: 'Paper' },
                { key: 'purpur', name: 'Purpur' },
                { key: 'folia', name: 'Folia' },
                { key: 'forge', name: 'Forge' },
                { key: 'fabric', name: 'Fabric' },
                { key: 'neoforge', name: 'NeoForge' },
                { key: 'quilt', name: 'Quilt' }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const loadVersions = async (platform) => {
        setIsLoadingVersions(true);
        setSelectedPlatform(platform);
        try {
            const response = await fetch(`https://mcutils.com/api/server-jars/${platform.key}`);
            const data = await response.json();
            setVersions(data);
        } catch (error) {
            console.error('Failed to load versions:', error);
            addNotification(t('server_library.load_versions_failed', { name: platform.name }), 'error');
        } finally {
            setIsLoadingVersions(false);
        }
    };

    const loadInstalledSoftware = async () => {
        try {
            const servers = await window.electronAPI.getServers();
            const counts = {};
            servers.forEach(server => {
                if (server.software) {
                    counts[server.software] = (counts[server.software] || 0) + 1;
                }
            });
            setInstalledSoftware(counts);
        } catch (error) {
            console.error('Failed to load installed software:', error);
        }
    };

    const handleDownload = async (platform, version) => {
        try {
            setDownloading(`${platform.key}-${version.version}`);
            const response = await fetch(`https://mcutils.com/api/server-jars/${platform.key}/${version.version}`);
            const data = await response.json();
            const result = await window.electronAPI.downloadServerSoftware({
                platform: platform.key,
                version: version.version,
                downloadUrl: data.downloadUrl,
                name: platform.name
            });

            if (result.success) {
                addNotification(t('server_library.download_success', { name: platform.name, version: version.version }), 'success');
                await loadInstalledSoftware();
            } else {
                addNotification(t('server_library.download_failed', { error: result.error }), 'error');
            }
        } catch (err) {
            console.error(err);
            addNotification(t('server_library.download_failed', { error: err.message }), 'error');
        } finally {
            setDownloading(null);
        }
    };

    const handleSelectPlatform = (platform) => {
        if (selectedPlatform?.key === platform.key) {
            setSelectedPlatform(null);
            setVersions([]);
        } else {
            loadVersions(platform);
        }
    };

    const getInstallCount = (platformKey) => {
        return installedSoftware[platformKey] || 0;
    };

    return (
        <div className="p-8 h-full overflow-y-auto custom-scrollbar">
            {isLoading && <LoadingOverlay message={t('server_library.loading_platforms')} />}

            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white mb-1">{t('server_library.title')}</h1>
                <p className="text-gray-400 text-sm">{t('server_library.desc')}</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {platforms.map((platform) => {
                    const details = platformDetails[platform.key] || {
                        icon: '📦',
                        name: platform.name,
                        description: 'Minecraft server software',
                        color: 'from-gray-500/20'
                    };
                    const installCount = getInstallCount(platform.key);
                    const isSelected = selectedPlatform?.key === platform.key;

                    return (
                        <div key={platform.key} className="space-y-2">
                            <div
                                onClick={() => handleSelectPlatform(platform)}
                                className={`bg-surface/40 backdrop-blur-sm border ${isSelected ? 'border-primary/50 shadow-primary-glow/10' : 'border-white/5'} rounded-xl overflow-hidden hover:border-primary/50 transition-all cursor-pointer group`}
                            >
                                <div className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className={`w-16 h-16 bg-gradient-to-br ${details.color} to-transparent rounded-2xl flex items-center justify-center text-4xl border border-white/10 group-hover:scale-110 transition-transform`}>
                                                {details.icon}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h3 className="font-bold text-white text-xl">{details.name}</h3>
                                                    {installCount > 0 && (
                                                        <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full border border-primary/30">
                                                            {t('server_library.installed_count', { count: installCount })}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-gray-400 text-sm mb-2">{details.description}</p>
                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                        </svg>
                                                        {isSelected ? t('server_library.hide_versions') : t('server_library.show_versions')}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={`transform transition-transform ${isSelected ? 'rotate-180' : ''}`}>
                                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {isSelected && (
                                    <div className="pl-24 pr-6 pb-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                        {isLoadingVersions ? (
                                            <div className="flex items-center gap-3 py-4 text-gray-400 text-sm justify-center">
                                                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                                {t('server_library.loading_versions')}
                                            </div>
                                        ) : (
                                            versions.map((version) => {
                                                const isDownloading = downloading === `${platform.key}-${version.version}`;
                                                return (
                                                    <div
                                                        key={version.version}
                                                        className="bg-surface/20 border border-white/5 rounded-xl p-4 hover:border-primary/50 transition-all flex items-center justify-between group/version"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-sm font-mono text-gray-300">{version.version}</span>
                                                            {version.release && (
                                                                <span className="text-xs text-gray-500 capitalize">{version.release}</span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownload(platform, version);
                                                            }}
                                                            disabled={isDownloading}
                                                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${isDownloading
                                                                ? 'bg-primary/20 text-primary cursor-wait'
                                                                : 'bg-primary/20 text-primary hover:bg-primary/30 active:scale-95'
                                                                }`}
                                                        >
                                                            {isDownloading ? (
                                                                <>
                                                                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                                                    {t('server_library.downloading_dots')}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                    </svg>
                                                                    {t('server_library.download_btn')}
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ServerLibrary;