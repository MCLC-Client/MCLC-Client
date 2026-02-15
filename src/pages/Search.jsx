import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';

function Search() {
    const { addNotification } = useNotification();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [projectType, setProjectType] = useState('mod'); // 'mod', 'resourcepack', 'modpack', 'shader'

    // Pagination
    const [offset, setOffset] = useState(0);
    const limit = 20;
    const [totalHits, setTotalHits] = useState(0);
    const [sortMethod, setSortMethod] = useState('relevance');

    // Install Modal State
    const [showInstallModal, setShowInstallModal] = useState(false);
    const [selectedMod, setSelectedMod] = useState(null);
    const [instances, setInstances] = useState([]);
    const [selectedInstance, setSelectedInstance] = useState('');
    const [installing, setInstalling] = useState(false);
    const [installedIds, setInstalledIds] = useState(new Set());

    // Hilfsfunktion für intelligente Download-Formatierung
    const formatDownloads = (downloads) => {
        if (downloads === undefined || downloads === null) return '0';

        if (downloads >= 1_000_000_000) {
            return (downloads / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
        }
        if (downloads >= 1_000_000) {
            return (downloads / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (downloads >= 1_000) {
            return (downloads / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return downloads.toString();
    };

    useEffect(() => {
        handleSearch();
    }, [offset, sortMethod, projectType]); // Trigger search on offset, sort, or type change

    const handleSearch = async (e) => {
        if (e) e.preventDefault();

        setLoading(true);
        try {
            const res = await window.electronAPI.searchModrinth(query, [], {
                offset,
                limit,
                index: sortMethod,
                projectType
            });

            if (res.success) {
                setResults(res.results);
                setTotalHits(res.total_hits);
            } else {
                addNotification('Search failed: ' + res.error, 'error');
            }
        } catch (err) {
            addNotification('Search error: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (offset + limit < totalHits) setOffset(offset + limit);
    };

    const handlePrev = () => {
        if (offset - limit >= 0) setOffset(offset - limit);
    };

    const toggleProjectType = (type) => {
        setProjectType(type);
        setOffset(0);
        setResults([]);
        setTotalHits(0);
    };

    const handleModpackInstall = async (mod) => {
        if (installing) return;
        setInstalling(true);
        try {
            addNotification(`Fetching versions for ${mod.title}...`, 'info');
            // 1. Get versions
            const res = await window.electronAPI.getModVersions(mod.slug, [], []);

            if (!res || !res.success || !res.versions || res.versions.length === 0) {
                addNotification("No versions found for this modpack.", 'error');
                return;
            }

            // 2. Pick latest version's primary file
            const versions = res.versions;
            const latestVersion = versions[0];
            const primaryFile = latestVersion.files.find(f => f.primary) || latestVersion.files[0];

            if (!primaryFile) {
                addNotification("No file found for the latest version.", 'error');
                return;
            }

            // 3. Install
            addNotification(`Starting installation of ${mod.title}...`, 'info');
            const installRes = await window.electronAPI.installModpack(primaryFile.url, mod.title);

            if (installRes.success) {
                addNotification(`Successfully started installing ${mod.title}. Check Dashboard.`, 'success');
                // Temporarily mark as installed/installing
                setInstalledIds(prev => new Set(prev).add(mod.project_id));
            } else {
                addNotification(`Failed to install: ${installRes.error}`, 'error');
            }

        } catch (e) {
            console.error("Modpack install error:", e);
            addNotification("An error occurred during installation.", 'error');
        } finally {
            setInstalling(false);
        }
    };

    const openInstall = async (mod) => {
        if (projectType === 'modpack') {
            await handleModpackInstall(mod);
            return;
        }

        setSelectedMod(mod);
        const list = await window.electronAPI.getInstances();
        setInstances(list || []);
        if (list && list.length > 0) setSelectedInstance(list[0].name);
        setShowInstallModal(true);
    };

    const handleInstall = async () => {
        if (!selectedInstance || !selectedMod) return;

        const instance = instances.find(i => i.name === selectedInstance);
        if (!instance) return;

        setInstalling(true);
        try {
            addNotification(`Checking compatibility for ${instance.name}...`, 'info');

            // Relax loader filter for shaders and resourcepacks
            const loaders = (selectedMod.project_type === 'shader' || selectedMod.project_type === 'resourcepack' || !instance.loader || instance.loader.toLowerCase() === 'vanilla')
                ? []
                : [instance.loader];

            const res = await window.electronAPI.getModVersions(selectedMod.project_id, loaders, [instance.version]);

            if (res.success && res.versions.length > 0) {
                const version = res.versions[0];
                const file = version.files.find(f => f.primary) || version.files[0];

                addNotification(`Installing ${selectedMod.title}...`, 'info');
                await window.electronAPI.installMod({
                    instanceName: instance.name,
                    projectId: selectedMod.project_id,
                    versionId: version.id,
                    filename: file.filename,
                    url: file.url,
                    projectType: selectedMod.project_type
                });

                // Feedback: Show "Installed" briefly
                setInstalledIds(prev => new Set(prev).add(selectedMod.project_id));
                setTimeout(() => {
                    setInstalledIds(prev => {
                        const next = new Set(prev);
                        next.delete(selectedMod.project_id);
                        return next;
                    });
                }, 3000);

                addNotification(`Successfully installed ${selectedMod.title}!`, 'success');
                setShowInstallModal(false);
            } else {
                addNotification(`No compatible versions found for ${instance.version} (${instance.loader})`, 'error');
            }
        } catch (e) {
            addNotification('Installation failed: ' + e.message, 'error');
        } finally {
            setInstalling(false);
        }
    };

    return (
        <div className="h-full p-8 flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">Find Content</h1>
                <div className="flex bg-surface rounded-xl p-1 border border-white/5">
                    <button
                        onClick={() => toggleProjectType('mod')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${projectType === 'mod' ? 'bg-primary text-black shadow-primary-glow' : 'text-gray-400 hover:text-white'}`}
                    >
                        Mods
                    </button>
                    <button
                        onClick={() => toggleProjectType('resourcepack')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${projectType === 'resourcepack' ? 'bg-primary text-black shadow-primary-glow' : 'text-gray-400 hover:text-white'}`}
                    >
                        Resource Packs
                    </button>
                    <button
                        onClick={() => toggleProjectType('modpack')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${projectType === 'modpack' ? 'bg-primary text-black shadow-primary-glow' : 'text-gray-400 hover:text-white'}`}
                    >
                        Modpacks
                    </button>
                    <button
                        onClick={() => toggleProjectType('shader')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${projectType === 'shader' ? 'bg-primary text-black shadow-primary-glow' : 'text-gray-400 hover:text-white'}`}
                    >
                        Shaders
                    </button>
                </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setOffset(0); handleSearch(); }} className="mb-6 flex gap-4">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Search for ${projectType === 'mod' ? 'mods' : projectType === 'resourcepack' ? 'resource packs' : projectType === 'modpack' ? 'modpacks' : 'shaders'}...`}
                    className="flex-1 bg-background-dark border border-white/10 rounded-xl p-4 text-white focus:border-primary outline-none shadow-inner"
                />
                <button
                    type="submit"
                    className="bg-primary text-black font-bold px-8 py-3 rounded-xl hover:scale-105 transition-transform"
                >
                    Search
                </button>
            </form>

            <div className="flex justify-between items-center mb-4 px-1">
                <div className="text-sm text-gray-400">
                    Found {totalHits} {projectType === 'mod' ? 'mods' : 'packs'}
                </div>
                <select
                    value={sortMethod}
                    onChange={(e) => setSortMethod(e.target.value)}
                    className="bg-surface border-none rounded-lg px-4 py-2 text-white outline-none appearance-none cursor-pointer focus:outline-none focus:border-none focus:ring-0"
                >
                    <option value="relevance">Relevance</option>
                    <option value="downloads">Downloads</option>
                    <option value="newest">Newest</option>
                    <option value="updated">Updated</option>
                </select>

            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-4">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="bg-surface h-48 rounded-xl animate-pulse border border-white/5"></div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {results.map((mod) => (
                            <div key={mod.project_id} className="bg-surface p-5 rounded-2xl border border-white/5 hover:border-primary/50 transition-all group flex flex-col shadow-lg">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-16 h-16 rounded-xl bg-background-dark overflow-hidden shrink-0 shadow-md">
                                        <img src={mod.icon_url || 'https://cdn.modrinth.com/placeholder.svg'} alt="" className="w-full h-full object-cover" onError={(e) => e.target.src = 'https://cdn.modrinth.com/placeholder.svg'} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-lg text-white truncate" title={mod.title}>{mod.title}</h3>
                                        <p className="text-xs text-gray-500 mt-1">{mod.author}</p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-gray-400 capitalize border border-white/5">{mod.project_type}</span>
                                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded border border-primary/20 flex items-center gap-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" transform="rotate(180 10 10)" /></svg>
                                                {formatDownloads(mod.downloads)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-400 mb-4 line-clamp-2 flex-1 leading-relaxed">{mod.description}</p>
                                <button
                                    onClick={() => openInstall(mod)}
                                    disabled={installing}
                                    className={`w-full font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${installedIds.has(mod.project_id)
                                        ? 'bg-primary text-black'
                                        : 'bg-white/5 hover:bg-primary hover:text-black text-white group-hover:bg-white/10'
                                        }`}
                                >
                                    {installedIds.has(mod.project_id) ? (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-bounce" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            {projectType === 'modpack' ? 'Installing...' : 'Installed'}
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:scale-110" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                                            {projectType === 'modpack' ? 'Create Instance' : 'Install'}
                                        </>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            <div className="mt-auto flex justify-between items-center bg-surface p-4 rounded-xl border border-white/5 shadow-2xl">
                <button
                    onClick={handlePrev}
                    disabled={offset === 0}
                    className="px-6 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-bold"
                >
                    Previous
                </button>
                <div className="flex items-center gap-4">
                    <span className="text-gray-400 font-mono text-sm uppercase tracking-wider">
                        Page {Math.floor(offset / limit) + 1}
                    </span>
                    <div className="h-4 w-[1px] bg-white/10" />
                    <span className="text-gray-500 text-xs">
                        of {Math.ceil(totalHits / limit)}
                    </span>
                </div>
                <button
                    onClick={handleNext}
                    disabled={offset + limit >= totalHits}
                    className="px-6 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-bold"
                >
                    Next
                </button>
            </div>

            {/* Install Modal */}
            {showInstallModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface w-full max-w-md rounded-2xl p-6 border border-white/10 shadow-primary-glow animate-scale-in">
                        <h2 className="text-2xl font-bold mb-4">Install {selectedMod?.title}</h2>

                        <div className="mb-6">
                            <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">Select Instance</label>
                            <select
                                value={selectedInstance}
                                onChange={(e) => setSelectedInstance(e.target.value)}
                                className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-primary outline-none appearance-none"
                            >
                                {instances.map(inst => (
                                    <option key={inst.name} value={inst.name}>{inst.name} ({inst.loader} {inst.version})</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowInstallModal(false)}
                                className="px-6 py-2 rounded-xl hover:bg-white/5 text-gray-300 font-bold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleInstall}
                                disabled={installing}
                                className="bg-primary text-black font-bold px-6 py-2 rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {installing && <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>}
                                {installing ? 'Installing...' : 'Install'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Search;