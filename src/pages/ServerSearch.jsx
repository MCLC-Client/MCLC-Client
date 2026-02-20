import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import { Analytics } from '../services/Analytics';
import ModDependencyModal from '../components/ModDependencyModal';

function Search({ initialCategory, onCategoryConsumed }) {
    const { addNotification } = useNotification();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [projectType, setProjectType] = useState(initialCategory || 'plugin');
    const [offset, setOffset] = useState(0);
    const limit = 20;
    const [totalHits, setTotalHits] = useState(0);
    const [sortMethod, setSortMethod] = useState('relevance');
    useEffect(() => {
        if (initialCategory) {
            setProjectType(initialCategory);
            if (onCategoryConsumed) onCategoryConsumed();
        }
    }, [initialCategory]);
    const [showInstallModal, setShowInstallModal] = useState(false);
    const [selectedMod, setSelectedMod] = useState(null);
    const [selectedServer, setSelectedServer] = useState('');
    const [servers, setServers] = useState([]);
    const [installing, setInstalling] = useState(false);
    const [installedIds, setInstalledIds] = useState(new Set());
    const [instanceInstalledIds, setInstanceInstalledIds] = useState(new Set());
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewProject, setPreviewProject] = useState(null);
    const [lightboxIndex, setLightboxIndex] = useState(-1);
    const [showDependencyModal, setShowDependencyModal] = useState(false);
    const [pendingDependencies, setPendingDependencies] = useState([]);
    const [resolvedForInstance, setResolvedForInstance] = useState(null);

    const handleNextImage = (e) => {
        e.stopPropagation();
        if (previewProject && previewProject.gallery) {
            setLightboxIndex((prev) => (prev + 1) % previewProject.gallery.length);
        }
    };

    const handlePrevImage = (e) => {
        e.stopPropagation();
        if (previewProject && previewProject.gallery) {
            setLightboxIndex((prev) => (prev - 1 + previewProject.gallery.length) % previewProject.gallery.length);
        }
    };
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (lightboxIndex === -1) return;
            if (e.key === 'ArrowRight') handleNextImage(e);
            if (e.key === 'ArrowLeft') handlePrevImage(e);
            if (e.key === 'Escape') setLightboxIndex(-1);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxIndex, previewProject]);

    const handlePreview = async (mod) => {
        try {
            addNotification(`Loading preview for ${mod.title}...`, 'info');
            const res = await window.electronAPI.getModrinthProject(mod.project_id);
            if (res.success) {
                const fullProject = {
                    ...res.project,
                    project_id: res.project.id,
                    project_type: mod.project_type
                };
                setPreviewProject(fullProject);
                setShowPreviewModal(true);
            } else {
                addNotification('Failed to load preview: ' + res.error, 'error');
            }
        } catch (e) {
            console.error(e);
            addNotification('Error loading preview.', 'error');
        }
    };
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
    }, [offset, sortMethod, projectType]);

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
    useEffect(() => {
        if (showInstallModal && selectedServer) {
            checkInstanceInstalled();
        } else {
            setInstanceInstalledIds(new Set());
        }
    }, [selectedServer, showInstallModal, projectType]);

    const checkInstanceInstalled = async () => {
        try {
            if (projectType === 'mod' || projectType === 'plugin') {
                const res = await window.electronAPI.getServerMods(selectedServer); // This doesn't exist yet so we'll just skip checking or use getMods in the future if mapped. For now just clear.
                setInstanceInstalledIds(new Set());
            }
        } catch (e) {
            console.error("Failed to check installed content", e);
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

    const openInstall = async (mod) => {
        setSelectedMod(mod);
        const list = await window.electronAPI.getServers();
        setServers(list); // Store the list of servers
        if (list && list.length > 0) setSelectedServer(list[0].name);
        setShowInstallModal(true);
    };

    const handleInstall = async () => {
        if (!selectedServer || !selectedMod) return;

        // Find the selected server object to get its details like loader and version
        const server = servers.find(s => s.name === selectedServer);
        if (!server) {
            addNotification('Selected server not found.', 'error');
            return;
        }

        setInstalling(true);
        try {
            addNotification(`Resolving dependencies for ${selectedMod.title}...`, 'info');
            // For servers, we pass an empty array or specific loader logic in the future.
            // If the server has a loader, use it, otherwise an empty array.
            const loaders = (selectedMod.project_type === 'shader' || selectedMod.project_type === 'resourcepack' || !server.loader || server.loader.toLowerCase() === 'vanilla')
                ? []
                : [server.loader];

            const res = await window.electronAPI.getModVersions(selectedMod.project_id, loaders, [server.version]);

            if (res.success && res.versions.length > 0) {
                const version = res.versions[0];

                // Resolve dependencies
                const depRes = await window.electronAPI.resolveDependencies(version.id, loaders, [server.version]);

                if (depRes.success && depRes.dependencies.length > 1) {
                    setPendingDependencies(depRes.dependencies);
                    setResolvedForInstance(server); // Pass the server object here
                    setShowDependencyModal(true);
                    setShowInstallModal(false);
                } else {
                    // Just install the primary mod
                    const file = version.files.find(f => f.primary) || version.files[0];
                    await executeInstallList([{
                        instanceName: selectedServer,
                        projectId: selectedMod.project_id,
                        versionId: version.id,
                        filename: file.filename,
                        url: file.url,
                        projectType: selectedMod.project_type,
                        title: selectedMod.title,
                        isServer: true
                    }]);
                }
            } else {
                addNotification(`No compatible versions found for the server`, 'error');
            }
        } catch (e) {
            addNotification('Resolution failed: ' + e.message, 'error');
        } finally {
            setInstalling(false);
        }
    };

    const executeInstallList = async (installList) => {
        if (!installList || installList.length === 0) return;

        setInstalling(true);
        try {
            for (let i = 0; i < installList.length; i++) {
                const item = installList[i];
                addNotification(`Installing ${item.title} (${i + 1}/${installList.length})...`, 'info');

                const res = await window.electronAPI.modrinthInstall({
                    instanceName: item.instanceName,
                    projectId: item.projectId,
                    versionId: item.versionId,
                    filename: item.filename,
                    url: item.url,
                    projectType: item.projectType,
                    isServer: item.isServer
                });

                if (res.success) {
                    setInstalledIds(prev => new Set(prev).add(item.projectId));
                    setInstanceInstalledIds(prev => new Set(prev).add(item.projectId));
                    Analytics.trackDownload(item.projectType, item.title, item.projectId);
                } else {
                    addNotification(`Failed to install ${item.title}: ${res.error}`, 'error');
                }
            }
            addNotification(`Successfully installed ${installList.length} item(s)!`, 'success');
            setShowInstallModal(false);
            setShowDependencyModal(false);
        } catch (e) {
            addNotification('Batch installation failed: ' + e.message, 'error');
        } finally {
            setInstalling(false);
        }
    };

    const handleDependencyConfirm = async (selectedMods) => {
        if (!resolvedForInstance) return;

        const installList = selectedMods.map(m => ({
            instanceName: resolvedForInstance.name,
            projectId: m.projectId,
            versionId: m.versionId,
            filename: m.filename,
            url: m.url,
            projectType: m.projectType,
            title: m.title
        }));

        await executeInstallList(installList);
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
                        onClick={() => toggleProjectType('plugin')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${projectType === 'plugin' ? 'bg-primary text-black shadow-primary-glow' : 'text-gray-400 hover:text-white'}`}
                    >
                        Plugins
                    </button>
                </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setOffset(0); handleSearch(); }} className="mb-6 flex gap-4">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Search for ${projectType === 'mod' ? 'mods' : 'plugins'}...`}
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
                    Found {totalHits} {projectType === 'mod' ? 'mods' : 'plugins'}
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
                                        ? 'bg-[#10b981] text-white shadow-[#10b981]/20 shadow-lg'
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

            { }
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

            { }
            {
                showInstallModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-surface w-full max-w-md rounded-2xl p-6 border border-white/10 shadow-primary-glow animate-scale-in">
                            <h2 className="text-2xl font-bold mb-4">Install {selectedMod?.title}</h2>

                            <div className="mb-6">
                                <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">Select Server</label>
                                <select
                                    value={selectedServer}
                                    onChange={(e) => setSelectedServer(e.target.value)}
                                    className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-primary outline-none appearance-none"
                                >
                                    {servers && servers.map(inst => (
                                        <option key={inst.name} value={inst.name}>{inst.name} ({inst.software} {inst.version})</option>
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
                                    disabled={installing || !selectedServer}
                                    className={`bg-primary text-black font-bold px-6 py-2 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 ${instanceInstalledIds.has(selectedMod?.project_id) ? 'bg-[#10b981] text-white hover:bg-[#059669]' : 'hover:bg-primary-hover'}`}
                                >
                                    {installing && <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>}
                                    {installing ? 'Installing...' : (instanceInstalledIds.has(selectedMod?.project_id) ? 'Already Installed' : 'Install')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            { }
            {
                showPreviewModal && previewProject && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-surface w-full max-w-5xl h-[85vh] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-scale-in">
                            { }
                            <div className="p-6 border-b border-white/5 flex justify-between items-start bg-background-dark/50">
                                <div className="flex gap-4">
                                    <img
                                        src={previewProject.icon_url || 'https://cdn.modrinth.com/placeholder.svg'}
                                        className="w-16 h-16 rounded-xl shadow-lg"
                                        alt=""
                                    />
                                    <div>
                                        <h2 className="text-2xl font-bold text-white mb-1">{previewProject.title}</h2>
                                        <p className="text-gray-400 text-sm max-w-xl line-clamp-2">{previewProject.description}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowPreviewModal(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            { }
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-background/50">
                                {previewProject.gallery && previewProject.gallery.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {previewProject.gallery.map((img, idx) => (
                                            <div
                                                key={idx}
                                                className="relative group rounded-xl overflow-hidden border border-white/5 bg-background-dark aspect-video cursor-zoom-in"
                                                onClick={() => setLightboxIndex(idx)}
                                            >
                                                <img
                                                    src={img.url}
                                                    alt={img.title || 'Gallery Image'}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                                {img.title && (
                                                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/70 backdrop-blur-sm text-xs text-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {img.title}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <p>No gallery images available for this project.</p>
                                    </div>
                                )}
                            </div>

                            { }
                            <div className="p-6 border-t border-white/5 bg-surface flex justify-end gap-4">
                                <button
                                    onClick={() => setShowPreviewModal(false)}
                                    className="px-6 py-3 rounded-xl hover:bg-white/5 text-white font-bold transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => {
                                        setShowPreviewModal(false);
                                        openInstall(previewProject);
                                    }}
                                    disabled={installedIds.has(previewProject.id)}
                                    className={`font-bold px-8 py-3 rounded-xl hover:scale-105 transition-all shadow-lg flex items-center gap-2 ${installedIds.has(previewProject.id)
                                        ? 'bg-[#10b981] text-white shadow-[#10b981]/20'
                                        : 'bg-primary text-black shadow-primary/20 hover:bg-primary-hover'
                                        }`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                    </svg>
                                    {installedIds.has(previewProject.id) ? 'Installed' : 'Install'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            { }
            {
                lightboxIndex !== -1 && previewProject && previewProject.gallery && (
                    <div
                        className="fixed inset-0 bg-black/95 z-[70] flex items-center justify-center animate-fade-in backdrop-blur-xl select-none"
                        onClick={() => setLightboxIndex(-1)}
                    >
                        { }
                        <button
                            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50"
                            onClick={() => setLightboxIndex(-1)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        { }
                        <button
                            className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-black/50 hover:bg-white/10 rounded-full text-white transition-colors z-50 backdrop-blur-sm group"
                            onClick={handlePrevImage}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <button
                            className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-black/50 hover:bg-white/10 rounded-full text-white transition-colors z-50 backdrop-blur-sm group"
                            onClick={handleNextImage}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>

                        { }
                        <div className="absolute top-6 left-6 text-white font-bold bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
                            {lightboxIndex + 1} / {previewProject.gallery.length}
                        </div>

                        { }
                        <div
                            className="w-full h-full flex items-center justify-center p-4 md:p-20"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={previewProject.gallery[lightboxIndex].url}
                                alt={previewProject.gallery[lightboxIndex].title || "Gallery Image"}
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-scale-in"
                            />
                            {previewProject.gallery[lightboxIndex].title && (
                                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md px-6 py-3 rounded-full text-white font-medium">
                                    {previewProject.gallery[lightboxIndex].title}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {showDependencyModal && (
                <ModDependencyModal
                    mods={pendingDependencies}
                    onConfirm={handleDependencyConfirm}
                    onCancel={() => setShowDependencyModal(false)}
                />
            )}
        </div >
    );
}

export default Search;