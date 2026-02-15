import React, { useState, useEffect } from 'react';

const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const weeks = Math.floor(diff / 604800000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (weeks === 1) return 'Last week';
    return `${weeks} weeks ago`;
};

const formatPlaytime = (ms) => {
    if (!ms || ms <= 0) return '0h';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

function Home({ onInstanceClick, runningInstances = {}, onNavigateSearch }) {
    const [instances, setInstances] = useState([]);
    const [modpacks, setModpacks] = useState([]);
    const [loadingModpacks, setLoadingModpacks] = useState(false);
    const [pendingLaunches, setPendingLaunches] = useState({});
    const [selectedModpack, setSelectedModpack] = useState(null);
    const [recentWorlds, setRecentWorlds] = useState([]);

    useEffect(() => {
        loadInstances();
        loadModpacks();

        const removeListener = window.electronAPI.onInstanceStatus(({ instanceName, status }) => {
            if (status === 'stopped' || status === 'ready' || status === 'error' || status === 'deleted') {
                loadInstances();
            }
        });

        return () => {
            if (removeListener) removeListener();
        };
    }, []);

    const loadInstances = async () => {
        const list = await window.electronAPI.getInstances();
        setInstances(list || []);

        // Load worlds for recently played instances
        if (list && list.length > 0) {
            const recentInsts = [...list]
                .filter(inst => inst.lastPlayed || inst.playtime > 0)
                .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
                .slice(0, 5);

            const allWorlds = [];
            for (const inst of recentInsts) {
                try {
                    const res = await window.electronAPI.getWorlds(inst.name);
                    if (res && res.success && res.worlds) {
                        for (const world of res.worlds.slice(0, 2)) {
                            allWorlds.push({
                                ...world,
                                instanceName: inst.name,
                                instanceIcon: inst.icon,
                                instanceVersion: inst.version,
                                instanceLoader: inst.loader,
                            });
                        }
                    }
                } catch (e) { /* ignore */ }
            }
            // Sort all worlds by lastPlayed and take top 3
            allWorlds.sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed));
            setRecentWorlds(allWorlds.slice(0, 3));
        }
    };

    const loadModpacks = async () => {
        setLoadingModpacks(true);
        try {
            const res = await window.electronAPI.searchModrinth('', [], {
                offset: 0,
                limit: 6,
                index: 'relevance',
                projectType: 'modpack'
            });
            if (res && res.success && res.results) {
                setModpacks(res.results);
            }
        } catch (e) {
            console.error('Failed to load modpacks:', e);
        } finally {
            setLoadingModpacks(false);
        }
    };

    const recentInstances = [...instances]
        .filter(inst => inst.lastPlayed || inst.playtime > 0)
        .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
        .slice(0, 5);

    const handleLaunch = async (e, instance) => {
        e.stopPropagation();
        const status = runningInstances[instance.name];
        const isRunning = status === 'running';
        const isInstalling = status === 'installing';
        const isLaunching = status === 'launching';

        if (isRunning) {
            window.electronAPI.killGame(instance.name);
            return;
        }
        if (isInstalling || isLaunching || pendingLaunches[instance.name]) return;

        setPendingLaunches(prev => ({ ...prev, [instance.name]: true }));
        try {
            const result = await window.electronAPI.launchGame(instance.name);
            if (!result.success) {
                console.error('Launch failed:', result.error);
            }
        } catch (err) {
            console.error('Launch error:', err.message);
        } finally {
            setPendingLaunches(prev => {
                const next = { ...prev };
                delete next[instance.name];
                return next;
            });
        }
    };

    return (
        <div className="p-8 h-full flex flex-col overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-1">Welcome back!</h1>
            </div>

            {/* Jump back in */}
            {recentInstances.length > 0 && (
                <div className="mb-10">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Jump back in</h2>
                    <div className="space-y-2">
                        {recentInstances.map((instance) => {
                            const status = runningInstances[instance.name];
                            const isRunning = status === 'running';
                            const isLaunching = status === 'launching';
                            const isInstalling = status === 'installing';
                            const isPending = pendingLaunches[instance.name];

                            return (
                                <div
                                    key={instance.name}
                                    onClick={() => onInstanceClick(instance)}
                                    className="group flex items-center gap-4 bg-surface/40 hover:bg-surface/60 border border-white/5 hover:border-primary/30 rounded-xl px-4 py-3 cursor-pointer transition-all"
                                >
                                    <div className="w-12 h-12 bg-background rounded-lg flex items-center justify-center overflow-hidden border border-white/5 shrink-0">
                                        {instance.icon && instance.icon.startsWith('data:') ? (
                                            <img src={instance.icon} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white truncate">{instance.name}</span>
                                            {isRunning && (
                                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Running</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                            {instance.lastPlayed && (
                                                <span>Played {formatTimeAgo(instance.lastPlayed)}</span>
                                            )}
                                            <span>•</span>
                                            <span className="bg-white/5 px-1.5 py-0.5 rounded capitalize text-[10px]">{instance.loader || 'Vanilla'}</span>
                                            <span>{instance.version}</span>
                                        </div>
                                    </div>

                                    <div className="hidden md:flex items-center gap-2 text-xs text-gray-400 mx-4">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>{formatPlaytime(instance.playtime)}</span>
                                    </div>

                                    <button
                                        onClick={(ev) => handleLaunch(ev, instance)}
                                        disabled={isInstalling || isLaunching || isPending}
                                        className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${isRunning
                                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                                            : (isInstalling || isLaunching || isPending)
                                                ? 'bg-gray-700/50 text-gray-500 cursor-wait border border-white/5'
                                                : 'bg-white/5 text-gray-300 hover:bg-primary/20 hover:text-primary border border-white/10 hover:border-primary/30'
                                            }`}
                                    >
                                        {isRunning ? (
                                            <>
                                                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><rect x="6" y="6" width="8" height="8" rx="1" /></svg>
                                                Stop
                                            </>
                                        ) : (isInstalling || isLaunching || isPending) ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                {isInstalling ? 'Installing...' : 'Starting...'}
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                                                Play
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); onInstanceClick(instance); }}
                                        className="shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                        </svg>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* No recent activity */}
            {recentInstances.length === 0 && (
                <div className="mb-10 p-8 border-2 border-dashed border-white/10 rounded-2xl text-center">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="text-gray-400 font-medium mb-1">No recent activity</p>
                    <p className="text-gray-600 text-sm">Play an instance to see it here</p>
                </div>
            )}

            {/* Recent Worlds */}
            {recentWorlds.length > 0 && (
                <div className="mb-10">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Recent Worlds</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {recentWorlds.map((world, idx) => {
                            const inst = instances.find(i => i.name === world.instanceName);
                            const status = inst ? runningInstances[inst.name] : null;
                            const isRunning = status === 'running';
                            const isLaunching = status === 'launching';
                            const isInstalling = status === 'installing';
                            const isPending = pendingLaunches[world.instanceName];

                            return (
                                <div
                                    key={`${world.instanceName}-${world.name}-${idx}`}
                                    onClick={() => {
                                        if (inst) onInstanceClick(inst);
                                    }}
                                    className="group bg-surface/40 hover:bg-surface/60 border border-white/5 hover:border-primary/30 rounded-xl p-4 cursor-pointer transition-all"
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-8 h-8 bg-background rounded-lg flex items-center justify-center overflow-hidden border border-white/5 shrink-0">
                                            {world.instanceIcon && world.instanceIcon.startsWith('data:') ? (
                                                <img src={world.instanceIcon} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">{world.name}</p>
                                            <p className="text-[10px] text-gray-500 truncate">{world.instanceName}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>
                                            <span>{formatTimeAgo(new Date(world.lastPlayed).getTime())}</span>
                                        </div>

                                        {/* Play button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isRunning) {
                                                    window.electronAPI.killGame(world.instanceName);
                                                    return;
                                                }
                                                if (isInstalling || isLaunching || isPending) return;

                                                setPendingLaunches(prev => ({ ...prev, [world.instanceName]: true }));
                                                window.electronAPI.launchGame(world.instanceName, { world: world.name })
                                                    .then(result => {
                                                        if (!result.success) console.error('Launch failed:', result.error);
                                                    })
                                                    .catch(err => console.error('Launch error:', err.message))
                                                    .finally(() => {
                                                        setPendingLaunches(prev => {
                                                            const next = { ...prev };
                                                            delete next[world.instanceName];
                                                            return next;
                                                        });
                                                    });
                                            }}
                                            disabled={isInstalling || isLaunching || isPending}
                                            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${isRunning
                                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                                                : (isInstalling || isLaunching || isPending)
                                                    ? 'bg-gray-700/50 text-gray-500 cursor-wait border border-white/5'
                                                    : 'bg-white/5 text-gray-300 hover:bg-primary/20 hover:text-primary border border-white/10 hover:border-primary/30'
                                                }`}
                                        >
                                            {isRunning ? (
                                                <>
                                                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><rect x="6" y="6" width="8" height="8" rx="1" /></svg>
                                                    Stop
                                                </>
                                            ) : (isInstalling || isLaunching || isPending) ? (
                                                <>
                                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    {isInstalling ? 'Installing' : 'Starting'}
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                                                    Play
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Discover a modpack */}
            <div className="mb-8">
                <button
                    onClick={() => onNavigateSearch && onNavigateSearch('modpack')}
                    className="flex items-center gap-2 mb-4 group cursor-pointer"
                >
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider group-hover:text-primary transition-colors">Discover a modpack</h2>
                    <svg className="w-4 h-4 text-gray-500 group-hover:text-primary group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>

                {loadingModpacks ? (
                    <div className="flex items-center gap-3 text-gray-500 text-sm">
                        <div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin"></div>
                        Loading modpacks...
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {modpacks.map((pack) => (
                            <div
                                key={pack.project_id || pack.slug}
                                className="group relative rounded-xl overflow-hidden border border-white/5 hover:border-primary/30 transition-all cursor-pointer bg-surface/30 hover:bg-surface/50"
                                onClick={() => setSelectedModpack(pack)}
                            >
                                <div className="aspect-video w-full overflow-hidden bg-background">
                                    {pack.gallery && pack.gallery.length > 0 ? (
                                        <img
                                            src={pack.gallery[0]}
                                            alt={pack.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : pack.icon_url ? (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-transparent">
                                            <img src={pack.icon_url} alt={pack.title} className="w-16 h-16 rounded-lg" />
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                        </div>
                                    )}
                                </div>

                                <div className="p-3">
                                    <div className="flex items-start gap-2">
                                        {pack.icon_url && (
                                            <img src={pack.icon_url} alt="" className="w-8 h-8 rounded-lg shrink-0 border border-white/10" />
                                        )}
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">{pack.title}</h3>
                                            <p className="text-[10px] text-gray-500 mt-0.5">by {pack.author}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" /></svg>
                                            {pack.downloads ? `${(pack.downloads / 1000).toFixed(0)}k` : '0'}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                            {pack.follows || 0}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modpack Detail Modal */}
            {selectedModpack && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
                    onClick={() => setSelectedModpack(null)}
                >
                    <div
                        className="bg-surface border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header with Cover */}
                        <div className="relative">
                            {selectedModpack.gallery && selectedModpack.gallery.length > 0 ? (
                                <img
                                    src={selectedModpack.gallery[0]}
                                    alt={selectedModpack.title}
                                    className="w-full h-48 object-cover"
                                />
                            ) : (
                                <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-background flex items-center justify-center">
                                    {selectedModpack.icon_url ? (
                                        <img src={selectedModpack.icon_url} alt="" className="w-20 h-20 rounded-xl" />
                                    ) : (
                                        <svg className="w-16 h-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                    )}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent"></div>

                            {/* Close button */}
                            <button
                                onClick={() => setSelectedModpack(null)}
                                className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="flex items-start gap-4 mb-4">
                                {selectedModpack.icon_url && (
                                    <img src={selectedModpack.icon_url} alt="" className="w-16 h-16 rounded-xl border border-white/10 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-2xl font-bold text-white">{selectedModpack.title}</h2>
                                    <p className="text-sm text-gray-400 mt-1">by {selectedModpack.author}</p>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="flex items-center gap-1.5 text-sm text-gray-400">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" /></svg>
                                    <span>{selectedModpack.downloads ? `${(selectedModpack.downloads / 1000).toFixed(0)}k downloads` : '0 downloads'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-sm text-gray-400">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                    <span>{selectedModpack.follows || 0} followers</span>
                                </div>
                                {selectedModpack.categories && selectedModpack.categories.length > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        {selectedModpack.categories.map(cat => (
                                            <span key={cat} className="text-[10px] font-medium bg-white/5 text-gray-400 px-2 py-0.5 rounded-full capitalize">{cat}</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Description</h3>
                                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                                    {selectedModpack.description || 'No description available.'}
                                </p>
                            </div>

                            {/* Gallery */}
                            {selectedModpack.gallery && selectedModpack.gallery.length > 1 && (
                                <div className="mb-6">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Gallery</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {selectedModpack.gallery.slice(0, 4).map((img, i) => (
                                            <img key={i} src={img} alt="" className="w-full rounded-lg object-cover aspect-video border border-white/5" />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Versions / Game Versions */}
                            {selectedModpack.versions && selectedModpack.versions.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Supported Versions</h3>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(selectedModpack.display_categories || selectedModpack.versions || []).slice(0, 10).map(v => (
                                            <span key={v} className="text-xs bg-white/5 text-gray-400 px-2.5 py-1 rounded-lg border border-white/5">{v}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-white/5 flex items-center justify-between">
                            <a
                                href={`https://modrinth.com/modpack/${selectedModpack.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-gray-400 hover:text-primary transition-colors flex items-center gap-1.5"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                View on Modrinth
                            </a>
                            <button
                                onClick={() => setSelectedModpack(null)}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-sm font-medium transition-colors border border-white/10"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Home;
