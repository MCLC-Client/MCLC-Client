import React, { useState, useEffect, useRef } from 'react';
import Dropdown from '../components/Dropdown';
import InstanceSettingsModal from '../components/InstanceSettingsModal';
import { useNotification } from '../context/NotificationContext';
import { Analytics } from '../services/Analytics';

function InstanceDetails({ instance, onBack, runningInstances, onInstanceUpdate }) {
    const [activeTab, setActiveTab] = useState('content');

    // Content Tab State
    const [contentView, setContentView] = useState('mods'); // 'mods' | 'resourcepacks' | 'search'
    const [searchCategory, setSearchCategory] = useState('mod'); // 'mod' | 'resourcepack'
    const [mods, setMods] = useState([]);
    const [resourcePacks, setResourcePacks] = useState([]);
    const [loadingResourcePacks, setLoadingResourcePacks] = useState(false);
    const [shaders, setShaders] = useState([]);
    const [loadingShaders, setLoadingShaders] = useState(false);
    const [installationStatus, setInstallationStatus] = useState({}); // productId -> 'installing' | 'success' | 'failed'
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [searchTimeout, setSearchTimeout] = useState(null);
    const [sortMethod, setSortMethod] = useState('relevance');
    const [searchOffset, setSearchOffset] = useState(0);
    const [totalHits, setTotalHits] = useState(0);
    const limit = 10;

    // Installed Mods Search
    const [localSearchQuery, setLocalSearchQuery] = useState('');

    // Worlds Tab State
    const [worlds, setWorlds] = useState([]);

    // Drag-and-drop state
    const [isDragging, setIsDragging] = useState(false);

    // Logs Tab State
    const [log, setLog] = useState('');
    const [logFiles, setLogFiles] = useState([]);
    const [selectedLog, setSelectedLog] = useState('latest.log');
    const [logFilters, setLogFilters] = useState({
        info: true,
        warn: true,
        error: true,
        debug: false
    });
    const [autoScroll, setAutoScroll] = useState(true);
    const logContainerRef = useRef(null);

    // Launch Handling
    const status = runningInstances[instance.name];
    const isRunning = status === 'running';
    const isLaunching = status === 'launching';
    const isInstalling = status === 'installing';

    // Settings Modal
    const [showSettings, setShowSettings] = useState(false);

    // Modrinth Project Detail Modal
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectVersions, setProjectVersions] = useState([]);
    const [loadingVersions, setLoadingVersions] = useState(false);

    // Header Menu State
    const [showMenu, setShowMenu] = useState(false);

    // Initial Launch Pending State
    const [localPending, setLocalPending] = useState(false);

    // Confirmation Modal State
    const [modToDelete, setModToDelete] = useState(null);

    // Update States
    const [updates, setUpdates] = useState({}); // projectId -> updateData
    const [checkingUpdates, setCheckingUpdates] = useState(false);
    const [updatingMod, setUpdatingMod] = useState(null); // projectId being updated

    // Preview & Lightbox State
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewProject, setPreviewProject] = useState(null);
    const [lightboxIndex, setLightboxIndex] = useState(-1);

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

    // Keyboard navigation for lightbox
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

    const handlePreview = async (project) => {
        try {
            addNotification(`Loading preview for ${project.title}...`, 'info');
            const res = await window.electronAPI.getModrinthProject(project.project_id);
            if (res.success) {
                const fullProject = {
                    ...res.project,
                    project_id: res.project.id,
                    project_type: project.project_type
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

    const handleSettingsSave = (newConfig) => {
        // Update parent state so UI reflects changes immediately
        if (onInstanceUpdate) {
            onInstanceUpdate(newConfig);
        }
    };

    useEffect(() => {
        if (activeTab === 'content') {
            if (contentView === 'mods') loadMods();
            if (contentView === 'resourcepacks') loadResourcePacks();
            if (contentView === 'shaders') loadShaders();
            if (contentView === 'search' && searchResults.length === 0) handleSearch(null, true);
        }
        if (activeTab === 'worlds') loadWorlds();
        if (activeTab === 'logs') {
            loadLogFiles();
            loadLog();
        }
    }, [activeTab, contentView, instance, selectedLog]);

    // Track which project IDs are already installed to show "Installed" in search
    useEffect(() => {
        const installedIds = {};
        mods.forEach(m => { if (m.projectId) installedIds[m.projectId] = 'success'; });
        resourcePacks.forEach(p => { if (p.projectId) installedIds[p.projectId] = 'success'; });
        shaders.forEach(s => { if (s.projectId) installedIds[s.projectId] = 'success'; });

        setInstallationStatus(prev => ({
            ...prev,
            ...installedIds
        }));
    }, [mods, resourcePacks, shaders]);

    // Trigger search when sort or offset changes
    useEffect(() => {
        if (activeTab === 'content' && contentView === 'search') {
            handleSearch();
        }
    }, [sortMethod, searchOffset]);

    // Auto-scroll when log changes
    useEffect(() => {
        if (autoScroll && logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [log, autoScroll]);

    // Debounced instant search
    useEffect(() => {
        if (contentView !== 'search') return;
        if (searchTimeout) clearTimeout(searchTimeout);

        const timeout = setTimeout(() => {
            setSearchOffset(0); // Reset to page 1 on new query
            handleSearch(null, true);
        }, 300); // 300ms debounce

        setSearchTimeout(timeout);
        return () => clearTimeout(timeout);
    }, [searchQuery, contentView, searchCategory]);

    const loadMods = async () => {
        const res = await window.electronAPI.getMods(instance.name);
        if (res.success) setMods(res.mods);
    };

    const loadResourcePacks = async () => {
        setLoadingResourcePacks(true);
        try {
            const res = await window.electronAPI.getResourcePacks(instance.name);
            if (res.success) setResourcePacks(res.packs);
            else addNotification("Failed to load resource packs", 'error');
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingResourcePacks(false);
        }
    };

    const loadShaders = async () => {
        setLoadingShaders(true);
        try {
            const res = await window.electronAPI.getShaders(instance.name);
            if (res.success) setShaders(res.shaders);
            else addNotification("Failed to load shaders", 'error');
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingShaders(false);
        }
    };

    const loadWorlds = async () => {
        const res = await window.electronAPI.getWorlds(instance.name);
        if (res.success) setWorlds(res.worlds);
    };

    const loadLogFiles = async () => {
        const res = await window.electronAPI.getLogFiles(instance.name);
        if (res.success) {
            // Backend returns objects, we need names
            const names = res.files.map(f => f.name);
            setLogFiles(names);
        }
    };

    const loadLog = async () => {
        // If selecting latest.log and instance is running, prefer live logs
        if (selectedLog === 'latest.log' && isRunning) {
            const live = await window.electronAPI.getLiveLogs(instance.name);
            setLog(live.join('\n'));
        } else {
            const res = await window.electronAPI.getLog(instance.name, selectedLog);
            if (res.success) setLog(res.content);
        }
    };

    // Live Log Subscription and Auto-select
    useEffect(() => {
        // Auto-select install.log if installing and no specific log selected yet
        if (isInstalling && selectedLog === 'latest.log') {
            setSelectedLog('install.log');
        }

        const isLiveRequest = (activeTab === 'logs' && selectedLog === 'latest.log' && (isRunning || isLaunching)) ||
            (activeTab === 'logs' && selectedLog === 'install.log' && isInstalling);

        if (isLiveRequest) {
            const removeListener = window.electronAPI.onLaunchLog((line) => {
                setLog(prev => prev + '\n' + line);
            });
            return () => {
                if (removeListener) removeListener();
            };
        }
    }, [activeTab, isRunning, isLaunching, isInstalling, selectedLog]);

    // Auto-switch to Logs tab on launch
    const prevStatusRef = useRef(status);
    useEffect(() => {
        // If we transitioned from 'stopped' (or undefined) to 'launching'/'installing', switch to logs
        const wasStopped = !prevStatusRef.current || prevStatusRef.current === 'stopped';
        const isStarting = status === 'launching' || status === 'installing';

        if (wasStopped && isStarting) {
            setActiveTab('logs');
            setSelectedLog(status === 'installing' ? 'install.log' : 'latest.log');
        }

        prevStatusRef.current = status;
    }, [status]);

    const { addNotification } = useNotification();

    const handleCopyLog = () => {
        navigator.clipboard.writeText(log).then(() => {
            addNotification("Log copied to clipboard!", 'success');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            addNotification("Failed to copy log", 'error');
        });
    };

    // --- Mod Management ---
    const handleToggleMod = async (fileName) => {
        await window.electronAPI.toggleMod(instance.name, fileName);
        loadMods();
    };

    const handleDeleteMod = (fileName, type = 'mod') => {
        setModToDelete({ name: fileName, type });
    };

    const confirmDeleteMod = async () => {
        if (!modToDelete) return;
        const res = await window.electronAPI.deleteMod(instance.name, modToDelete.name, modToDelete.type);
        const deletedType = modToDelete.type;
        setModToDelete(null);

        if (res && res.success) {
            addNotification(`${deletedType === 'mod' ? 'Mod' : deletedType === 'shader' ? 'Shader' : 'Resource pack'} deleted successfully`, 'success');
            if (deletedType === 'mod') loadMods();
            else if (deletedType === 'resourcepack') loadResourcePacks();
            else if (deletedType === 'shader') loadShaders();
        } else {
            addNotification(`Failed to delete ${deletedType}: ${res?.error || 'Unknown error'}`, 'error');
        }
    };

    const handleCheckUpdates = async (silent = false) => {
        setCheckingUpdates(true);
        try {
            const contentToCheck = [
                ...mods.filter(m => m.projectId).map(m => ({ projectId: m.projectId, versionId: m.versionId, type: 'mod', name: m.name })),
                ...resourcePacks.filter(p => p.projectId).map(p => ({ projectId: p.projectId, versionId: p.versionId, type: 'resourcepack', name: p.name })),
                ...shaders.filter(s => s.projectId).map(s => ({ projectId: s.projectId, versionId: s.versionId, type: 'shader', name: s.name }))
            ];

            if (contentToCheck.length === 0) {
                if (!silent) addNotification("No Modrinth content found to check for updates.", 'info');
                return;
            }

            const res = await window.electronAPI.checkUpdates(instance.name, contentToCheck);
            if (res.success) {
                const updateMap = {};
                res.updates.forEach(u => {
                    updateMap[u.projectId] = u;
                });
                setUpdates(updateMap);
                const count = Object.keys(updateMap).length;
                if (count > 0) {
                    if (!silent) addNotification(`Found ${count} update(s)!`, 'success');
                } else {
                    if (!silent) addNotification("All mods and resource packs are up to date.", 'success');
                }
            } else {
                if (!silent) addNotification("Failed to check for updates: " + res.error, 'error');
            }
        } catch (e) {
            console.error(e);
            if (!silent) addNotification("Error checking updates: " + e.message, 'error');
        } finally {
            setCheckingUpdates(false);
        }
    };

    // Auto-check updates when content is loaded
    useEffect(() => {
        if (activeTab === 'content' && (mods.length > 0 || resourcePacks.length > 0)) {
            // Check if we already have updates (simple debounce/cache check)
            if (Object.keys(updates).length === 0 && !checkingUpdates) {
                handleCheckUpdates(true);
            }
        }
    }, [mods.length, resourcePacks.length, activeTab]);

    const handleUpdateMod = async (updateData) => {
        setUpdatingMod(updateData.projectId);
        try {
            const res = await window.electronAPI.updateFile({
                instanceName: instance.name,
                projectType: updateData.type,
                oldFileName: updateData.name,
                newFileName: updateData.filename,
                url: updateData.downloadUrl
            });

            if (res.success) {
                addNotification(`Updated ${updateData.filename}!`, 'success');
                // Remove from updates list
                setUpdates(prev => {
                    const next = { ...prev };
                    delete next[updateData.projectId];
                    return next;
                });
                // Reload lists
                if (updateData.type === 'mod') loadMods();
                else loadResourcePacks();
            } else {
                addNotification(`Failed to update: ${res.error}`, 'error');
            }
        } catch (e) {
            console.error(e);
            addNotification(`Update error: ${e.message}`, 'error');
        } finally {
            setUpdatingMod(null);
        }
    };

    const handleUpdateAll = async () => {
        const updateList = Object.values(updates);
        if (updateList.length === 0) return;

        addNotification(`Updating ${updateList.length} item(s)...`, 'info');

        // Use sequential updates to be safe with file operations and UI feedback
        for (const updateData of updateList) {
            await handleUpdateMod(updateData);
        }

        addNotification("All updates completed!", 'success');
    };

    // --- Search & Install ---
    const handleSearch = async (e, isAuto = false) => {
        if (e) e.preventDefault();
        setSearching(true);
        // Filter by instance version and loader
        const facets = [
            [`versions:${instance.version}`]
        ];

        // Only add loader facet for mods, resource packs are usually loader-independent or have their own logic
        if (searchCategory === 'mod' && instance.loader && instance.loader.toLowerCase() !== 'vanilla') {
            facets.push([`categories:${instance.loader.toLowerCase()}`]);
        }

        // If auto search (empty query), use relevance or popular
        // Modrinth Sort Options: relevance, downloads, newest, updated
        const index = sortMethod;

        const res = await window.electronAPI.searchModrinth(searchQuery, facets, {
            index,
            offset: searchOffset,
            limit,
            projectType: searchCategory
        });
        if (res.success) {
            setSearchResults(res.results);
            setTotalHits(res.total_hits || 0);
        }
        setSearching(false);
    };

    const handleNextPage = () => {
        if (searchOffset + limit < totalHits) setSearchOffset(searchOffset + limit);
    };

    const handlePrevPage = () => {
        if (searchOffset - limit >= 0) setSearchOffset(searchOffset - limit);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (contentView === 'mods' || contentView === 'resourcepacks') {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (contentView !== 'mods' && contentView !== 'resourcepacks') return;

        const files = Array.from(e.dataTransfer.files);

        if (contentView === 'mods') {
            const validFiles = files.filter(f => f.name.toLowerCase().endsWith('.jar'));
            if (validFiles.length === 0) {
                addNotification("Please drop .jar files only", 'error');
                return;
            }

            let addedCount = 0;
            for (const file of validFiles) {
                if (file.path) {
                    const res = await window.electronAPI.installLocalMod(instance.name, file.path);
                    if (res.success) addedCount++;
                }
            }
            if (addedCount > 0) {
                addNotification(`Successfully added ${addedCount} mod(s)`, 'success');
                loadMods();
            }
        } else {
            const validFiles = files.filter(f => f.name.toLowerCase().endsWith('.zip') || f.name.toLowerCase().endsWith('.rar'));
            if (validFiles.length === 0) {
                addNotification("Please drop .zip or .rar files only", 'error');
                return;
            }

            let addedCount = 0;
            for (const file of validFiles) {
                if (file.path) {
                    // Reusing installMod with a local file is tricky if it expects Modrinth version data
                    // Let's check backend/handlers/modrinth.js for a local file handler if it exists
                    // Actually I can just add a new handler or use installMod but with projectType
                    // Backend already has modrinth:install which takes filename/url
                    // I'll add instance:install-local-resourcepack to instances.js for simplicity
                    const res = await window.electronAPI.installLocalMod(instance.name, file.path, 'resourcepack');
                    if (res.success) addedCount++;
                }
            }
            if (addedCount > 0) {
                addNotification(`Successfully added ${addedCount} resource pack(s)`, 'success');
                loadResourcePacks();
            }
        }
    };

    const handleInstall = async (project) => {
        try {
            setInstallationStatus(prev => ({ ...prev, [project.project_id]: 'installing' }));

            // 1. Get versions - API returns { success: true, versions: [...] }
            // If it's a resourcepack or shader, don't filter by loader because packs are usually loader-independent
            const loaders = (searchCategory === 'resourcepack' || searchCategory === 'shader' || !instance.loader || instance.loader.toLowerCase() === 'vanilla')
                ? []
                : [instance.loader.toLowerCase()];
            const res = await window.electronAPI.getModVersions(project.project_id, loaders, [instance.version]);

            if (!res || !res.success || !res.versions || res.versions.length === 0) {
                addNotification("No compatible version found!", 'error');
                setInstallationStatus(prev => ({ ...prev, [project.project_id]: 'failed' }));
                return;
            }

            // 2. Install top version
            const targetVersion = res.versions[0];
            const file = targetVersion.files.find(f => f.primary) || targetVersion.files[0];

            const installRes = await window.electronAPI.installMod({
                instanceName: instance.name,
                projectId: project.project_id,
                versionId: targetVersion.id,
                filename: file.filename,
                url: file.url,
                projectType: searchCategory
            });

            if (installRes && installRes.success) {
                addNotification(`Installed ${project.title}!`, 'success');
                setInstallationStatus(prev => ({ ...prev, [project.project_id]: 'success' }));
                Analytics.trackDownload(searchCategory, project.title, project.project_id);
                // Reload lists if on installed view
                if (contentView === 'mods') loadMods();
                if (contentView === 'resourcepacks') loadResourcePacks();
            } else {
                addNotification(`Failed to install: ${installRes?.error || 'Unknown error'}`, 'error');
                setInstallationStatus(prev => ({ ...prev, [project.project_id]: 'failed' }));
            }
        } catch (e) {
            console.error('Install error:', e);
            addNotification(`Installation error: ${e.message}`, 'error');
            setInstallationStatus(prev => ({ ...prev, [project.project_id]: 'failed' }));
        }
    };

    const handleViewProject = async (project) => {
        setSelectedProject(project);
        setProjectVersions([]);
        setLoadingVersions(true);
        try {
            // Fetch versions filtered by game version and loader
            // Relax loader filter for resource packs and shaders
            const loaders = (project.project_type === 'resourcepack' || project.project_type === 'shader' || !instance.loader || instance.loader.toLowerCase() === 'vanilla')
                ? []
                : [instance.loader.toLowerCase()];
            const res = await window.electronAPI.getModVersions(project.project_id, loaders, [instance.version]);
            if (res && res.success && res.versions) {
                setProjectVersions(res.versions);
            }
        } catch (e) {
            console.error('Failed to load versions:', e);
        } finally {
            setLoadingVersions(false);
        }
    };

    const handleInstallVersion = async (version) => {
        try {
            setInstallationStatus(prev => ({ ...prev, [selectedProject.project_id]: 'installing' }));
            const file = version.files.find(f => f.primary) || version.files[0];
            const installRes = await window.electronAPI.installMod({
                instanceName: instance.name,
                projectId: selectedProject.project_id,
                versionId: version.id,
                filename: file.filename,
                url: file.url,
                projectType: searchCategory
            });

            if (installRes && installRes.success) {
                addNotification(`Installed ${selectedProject.title}!`, 'success');
                setInstallationStatus(prev => ({ ...prev, [selectedProject.project_id]: 'success' }));
                Analytics.trackDownload(searchCategory, selectedProject.title, selectedProject.project_id);
                if (contentView === 'mods') loadMods();
                if (contentView === 'resourcepacks') loadResourcePacks();
                setSelectedProject(null);
            } else {
                addNotification(`Failed to install: ${installRes?.error || 'Unknown error'}`, 'error');
                setInstallationStatus(prev => ({ ...prev, [selectedProject.project_id]: 'failed' }));
            }
        } catch (e) {
            console.error('Install error:', e);
            addNotification(`Installation error: ${e.message}`, 'error');
            setInstallationStatus(prev => ({ ...prev, [selectedProject.project_id]: 'failed' }));
        }
    };


    const handleLaunch = async () => {
        if (isRunning || isLaunching || isInstalling || localPending) return;
        setLocalPending(true);
        try {
            const result = await window.electronAPI.launchGame(instance.name);
            if (!result.success) {
                addNotification(`Launch failed: ${result.error}`, 'error');
            }
        } catch (e) {
            console.error('Launch exception:', e);
            addNotification(`Launch failed: ${e.message}`, 'error');
        } finally {
            setLocalPending(false);
        }
    };

    // Log Filtering Logic
    const getFilteredLog = () => {
        if (!log) return [];
        const lines = log.replace(/\r\n/g, '\n').split('\n');
        return lines.filter(line => {
            if (!line.trim()) return false;
            const lower = line.toLowerCase();
            if (logFilters.error && lower.includes('error')) return true;
            if (logFilters.warn && lower.includes('warn')) return true;
            if (logFilters.info && lower.includes('info')) return true;
            if (logFilters.debug && lower.includes('debug')) return true;
            if (!lower.includes('error') && !lower.includes('warn') && !lower.includes('info') && !lower.includes('debug')) {
                return logFilters.error || logFilters.warn || logFilters.info || logFilters.debug;
            }
            return false;
        });
    };

    const TAB_CLASSES = (id) => `px-6 py-2 font-bold transition-all border-b-2 ${activeTab === id ? 'border-primary text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`;

    // Helper for version display
    const getModVersion = (fileName) => {
        // Improved version parsing
        const parts = fileName.replace('.jar', '').replace('.disabled', '').split('-');
        if (parts.length > 1) {
            // Try to find a part that looks like a version number
            for (let i = parts.length - 1; i >= 0; i--) {
                if (/\d/.test(parts[i]) && parts[i].includes('.')) return 'v' + parts[i];
            }
            return 'v' + parts[parts.length - 1];
        }
        return '';
    };

    // Helper to get mod name from filename if no metadata
    const getModName = (fileName) => {
        return fileName.replace('.jar', '').replace('.disabled', '').split('-')[0].replace(/_/g, ' ');
    };

    return (
        <div className="h-full flex flex-col bg-transparent">
            {/* Header */}
            <div className="p-8 pb-0 flex items-center gap-6">
                <div className="w-32 h-32 bg-surface rounded-2xl flex items-center justify-center text-6xl shadow-2xl border border-white/10 overflow-hidden">
                    {instance.icon && instance.icon.startsWith('data:') ? (
                        <img src={instance.icon} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-6xl">{instance.icon || '📦'}</span>
                    )}
                </div>
                <div className="flex-1">
                    <h1 className="text-4xl font-bold mb-2 text-white tracking-tight flex items-center justify-between">
                        {instance.name}
                    </h1>
                    <div className="flex items-center gap-3 text-gray-400">
                        <span className="flex items-center gap-1.5 bg-surface px-3 py-1 rounded-full border border-white/5 text-sm">
                            {instance.loader === 'Fabric' && <div className="w-2 h-2 rounded-full bg-orange-200"></div>}
                            {instance.loader === 'Forge' && <div className="w-2 h-2 rounded-full bg-blue-200"></div>}
                            {instance.loader || 'Vanilla'}
                        </span>
                        <span className="text-gray-600">•</span>
                        <span className="text-sm font-mono opacity-80">{instance.version}</span>
                    </div>
                </div>
                <div className="flex gap-3">
                    {/* Play/Stop Button - Moved to First Position */}
                    {isRunning ? (
                        <button
                            onClick={() => window.electronAPI.killGame(instance.name)}
                            className="px-8 py-3 rounded-xl font-bold flex items-center gap-2 transform transition-all bg-red-500 hover:bg-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            Stop
                        </button>
                    ) : (
                        <button
                            onClick={handleLaunch}
                            className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 transform transition-all ${status === 'launching' || status === 'installing' || localPending ? 'bg-gray-600/50 text-gray-300 cursor-not-allowed border-gray-500' : 'bg-primary hover:bg-primary-hover text-black hover:scale-105 shadow-primary-glow border-transparent'}`}
                            disabled={status === 'launching' || status === 'installing' || localPending}
                        >
                            {status === 'launching' || localPending ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white/80" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {localPending ? 'Starting...' : 'Launching...'}
                                </>
                            ) : status === 'installing' ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white/80" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Installing...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                                    Play
                                </>
                            )}
                        </button>
                    )}

                    {/* Settings Button */}
                    <button onClick={() => setShowSettings(true)} className="p-3 rounded-xl bg-surface hover:bg-white/10 text-white font-bold border border-white/5 transition-colors" title="Settings">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>

                    {/* 3-Dot Menu Button */}
                    <div className="relative">
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-3 rounded-xl bg-surface hover:bg-white/10 text-white font-bold border border-white/5 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden text-sm">
                                <button
                                    onClick={() => {
                                        window.electronAPI.openInstanceFolder(instance.name);
                                        setShowMenu(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                                    Open Folder
                                </button>
                                <button
                                    onClick={async () => {
                                        setShowMenu(false);
                                        addNotification('Exporting instance...', 'info');
                                        try {
                                            const res = await window.electronAPI.exportInstance(instance.name);
                                            if (res.success) addNotification(`Exported to ${res.path}`, 'success');
                                            else if (res.error !== 'Cancelled') addNotification(`Export failed: ${res.error}`, 'error');
                                        } catch (e) {
                                            addNotification(`Export failed: ${e.message}`, 'error');
                                        }
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                    Export Modpack
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs Nav */}
            <div className="px-8 mt-8 flex gap-2 border-b border-white/5">
                <button onClick={() => setActiveTab('content')} className={TAB_CLASSES('content')}>Content</button>
                <button onClick={() => setActiveTab('worlds')} className={TAB_CLASSES('worlds')}>Worlds</button>
                <button onClick={() => setActiveTab('logs')} className={TAB_CLASSES('logs')}>Logs</button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden p-8">
                {activeTab === 'content' && (
                    <div className="h-full flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setContentView('mods'); setLocalSearchQuery(''); }}
                                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${contentView === 'mods' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
                                >
                                    Mods
                                </button>
                                <button
                                    onClick={() => { setContentView('resourcepacks'); setLocalSearchQuery(''); }}
                                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${contentView === 'resourcepacks' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
                                >
                                    Resource Packs
                                </button>
                                <button
                                    onClick={() => { setContentView('shaders'); setLocalSearchQuery(''); }}
                                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${contentView === 'shaders' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
                                >
                                    Shaders
                                </button>
                                <button
                                    onClick={() => { setContentView('search'); setLocalSearchQuery(''); }}
                                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${contentView === 'search' ? 'bg-primary/20 text-primary' : 'text-gray-500 hover:text-white'}`}
                                >
                                    Add Content
                                </button>
                            </div>

                            {contentView === 'search' && (
                                <div className="flex gap-1 bg-background-dark/50 p-1 rounded-lg border border-white/5 h-fit self-center">
                                    <button
                                        onClick={() => {
                                            setSearchCategory('mod');
                                            setSearchOffset(0);
                                        }}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${searchCategory === 'mod' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Mods
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSearchCategory('resourcepack');
                                            setSearchOffset(0);
                                        }}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${searchCategory === 'resourcepack' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Resource Packs
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSearchCategory('shader');
                                            setSearchOffset(0);
                                        }}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${searchCategory === 'shader' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Shaders
                                    </button>
                                </div>
                            )}

                            {(contentView === 'mods' || contentView === 'resourcepacks' || contentView === 'shaders') && (
                                <div className="flex items-center gap-3">
                                    {Object.keys(updates).length > 0 && (
                                        <button
                                            onClick={handleUpdateAll}
                                            className="px-4 py-1.5 bg-green-500 hover:bg-green-400 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-green-500/20 transition-all transform hover:scale-105"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            Update All ({Object.keys(updates).length})
                                        </button>
                                    )}
                                    <button
                                        onClick={handleCheckUpdates}
                                        disabled={checkingUpdates}
                                        className={`px-4 py-1.5 rounded-lg text-sm font-bold border transition-all flex items-center gap-2 ${checkingUpdates ? 'bg-white/5 border-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'}`}
                                    >
                                        {checkingUpdates ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Checking...
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                Check for Updates
                                            </>
                                        )}
                                    </button>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder={contentView === 'mods' ? "Filter mods..." : contentView === 'resourcepacks' ? "Filter resource packs..." : "Filter shaders..."}
                                            value={localSearchQuery}
                                            onChange={(e) => setLocalSearchQuery(e.target.value)}
                                            className="bg-background-dark border border-white/10 rounded-lg py-1.5 px-3 text-sm text-gray-300 w-64 focus:border-primary outline-none"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {contentView === 'mods' ? (
                            <div
                                className={`flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar transition-all rounded-xl relative ${isDragging ? 'bg-primary/5 ring-2 ring-primary ring-dashed ring-offset-4 ring-offset-background-dark' : ''}`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                {isDragging && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-primary/10 backdrop-blur-[2px] z-10 rounded-xl pointer-events-none">
                                        <div className="bg-primary text-black p-4 rounded-full shadow-primary-glow mb-2 animate-bounce">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                        </div>
                                        <div className="text-primary font-bold text-lg">Drop mods here to install</div>
                                        <div className="text-[10px] text-primary/60 uppercase tracking-widest mt-1">Accepting .jar files</div>
                                    </div>
                                )}
                                {mods.filter(m => m.title?.toLowerCase().includes(localSearchQuery.toLowerCase()) || m.name?.toLowerCase().includes(localSearchQuery.toLowerCase())).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                                        <div className="text-4xl mb-4 opacity-50">📂</div>
                                        <p className="text-lg font-medium">No mods found</p>
                                        <button onClick={() => setContentView('search')} className="mt-4 text-primary hover:underline">Browse mods</button>
                                    </div>
                                ) : (
                                    mods.filter(m => m.title?.toLowerCase().includes(localSearchQuery.toLowerCase()) || m.name?.toLowerCase().includes(localSearchQuery.toLowerCase()))
                                        .sort((a, b) => (a.title || a.name || "").localeCompare(b.title || b.name || ""))
                                        .map(mod => (
                                            <div key={mod.name} className="flex items-center justify-between p-3 bg-surface rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all group">
                                                <div className="flex items-center gap-4">
                                                    {mod.icon ? (
                                                        <img src={mod.icon} alt="" className="w-10 h-10 rounded-lg bg-background-dark/50 object-cover" />
                                                    ) : (
                                                        <div className="w-10 h-10 bg-background-dark/50 rounded-lg flex items-center justify-center text-gray-500 font-mono text-xs border border-white/5">jar</div>
                                                    )}
                                                    <div>
                                                        <div className={`font-bold ${!mod.enabled ? 'text-gray-500 line-through' : 'text-white'}`}>{mod.title || mod.name}</div>
                                                        <div className="flex gap-2 text-[10px] text-gray-500 mt-0.5">
                                                            <span className="bg-background-dark px-1.5 rounded">{mod.version || 'v?'}</span>
                                                            <span className="opacity-50">{mod.name}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    {updates[mod.projectId] && (
                                                        <button
                                                            onClick={() => handleUpdateMod(updates[mod.projectId])}
                                                            disabled={updatingMod === mod.projectId}
                                                            className={`p-2 rounded-lg transition-all transform hover:scale-110 ${updatingMod === mod.projectId ? 'bg-green-500/10 text-green-500 animate-pulse' : 'bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-black'}`}
                                                            title={`Update to ${updates[mod.projectId].newVersionNumber}`}
                                                        >
                                                            {updatingMod === mod.projectId ? (
                                                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    )}
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={mod.enabled} onChange={() => handleToggleMod(mod.name)} className="sr-only peer" />
                                                        <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                                    </label>
                                                    <button onClick={() => handleDeleteMod(mod.name, 'mod')} className="text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                )}
                            </div>
                        ) : contentView === 'resourcepacks' ? (
                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar transition-all rounded-xl relative">
                                {loadingResourcePacks ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                                        <p>Listing resource packs...</p>
                                    </div>
                                ) : resourcePacks.filter(p => p.title?.toLowerCase().includes(localSearchQuery.toLowerCase()) || p.name?.toLowerCase().includes(localSearchQuery.toLowerCase())).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                                        <div className="text-4xl mb-4 opacity-50">🎨</div>
                                        <p className="text-lg font-medium">No resource packs found</p>
                                        <p className="text-sm opacity-50 mb-4">Check the `resourcepacks` folder in the instance directory</p>
                                        <button onClick={() => { setContentView('search'); setSearchCategory('resourcepack'); }} className="mt-4 text-primary hover:underline font-bold">Browse packs</button>
                                    </div>
                                ) : (
                                    resourcePacks.filter(p => p.title?.toLowerCase().includes(localSearchQuery.toLowerCase()) || p.name?.toLowerCase().includes(localSearchQuery.toLowerCase()))
                                        .sort((a, b) => (a.title || a.name || "").localeCompare(b.title || b.name || ""))
                                        .map(pack => (
                                            <div key={pack.name} className="flex items-center justify-between p-3 bg-surface rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all group">
                                                <div className="flex items-center gap-4">
                                                    {pack.icon ? (
                                                        <img src={pack.icon} alt="" className="w-10 h-10 rounded-lg bg-background-dark/50 object-cover" />
                                                    ) : (
                                                        <div className="w-10 h-10 bg-background-dark/50 rounded-lg flex items-center justify-center text-gray-500 font-mono text-[10px] border border-white/5 text-center leading-tight">RES<br />PACK</div>
                                                    )}
                                                    <div>
                                                        <div className="font-bold text-white">{pack.title}</div>
                                                        <div className="flex gap-2 text-[10px] text-gray-500 mt-0.5">
                                                            {pack.version && <span className="bg-background-dark px-1.5 rounded">{pack.version}</span>}
                                                            <span className="opacity-50">{pack.name}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    {updates[pack.projectId] && (
                                                        <button
                                                            onClick={() => handleUpdateMod(updates[pack.projectId])}
                                                            disabled={updatingMod === pack.projectId}
                                                            className={`p-2 rounded-lg transition-all transform hover:scale-110 ${updatingMod === pack.projectId ? 'bg-green-500/10 text-green-500 animate-pulse' : 'bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-black'}`}
                                                            title={`Update to ${updates[pack.projectId].newVersionNumber}`}
                                                        >
                                                            {updatingMod === pack.projectId ? (
                                                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleDeleteMod(pack.name, 'resourcepack')} className="text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                )}
                            </div>
                        ) : contentView === 'shaders' ? (
                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar transition-all rounded-xl relative">
                                {loadingShaders ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                                        <p>Listing shaders...</p>
                                    </div>
                                ) : shaders.filter(s => s.title?.toLowerCase().includes(localSearchQuery.toLowerCase()) || s.name?.toLowerCase().includes(localSearchQuery.toLowerCase())).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                                        <div className="text-4xl mb-4 opacity-50">✨</div>
                                        <p className="text-lg font-medium">No shaders found</p>
                                        <p className="text-sm opacity-50 mb-4">Check the `shaderpacks` folder in the instance directory</p>
                                        <button onClick={() => { setContentView('search'); setSearchCategory('shader'); }} className="mt-4 text-primary hover:underline font-bold">Browse shaders</button>
                                    </div>
                                ) : (
                                    shaders.filter(s => s.title?.toLowerCase().includes(localSearchQuery.toLowerCase()) || s.name?.toLowerCase().includes(localSearchQuery.toLowerCase()))
                                        .sort((a, b) => (a.title || a.name || "").localeCompare(b.title || b.name || ""))
                                        .map(shader => (
                                            <div key={shader.name} className="flex items-center justify-between p-3 bg-surface rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center text-primary font-mono text-[10px] border border-primary/20 text-center leading-tight">SHA<br />DER</div>
                                                    <div>
                                                        <div className="font-bold text-white">{shader.title}</div>
                                                        <div className="flex gap-2 text-[10px] text-gray-500 mt-0.5">
                                                            <span className="opacity-50">{shader.name}</span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handlePreview(shader); }}
                                                            className="text-[10px] bg-white/5 hover:bg-white/10 text-gray-300 px-2 py-0.5 rounded mt-1 border border-white/5 flex items-center gap-1 transition-colors"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                            Preview
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    {updates[shader.projectId] && (
                                                        <button
                                                            onClick={() => handleUpdateMod(updates[shader.projectId])}
                                                            disabled={updatingMod === shader.projectId}
                                                            className={`p-2 rounded-lg transition-all transform hover:scale-110 ${updatingMod === shader.projectId ? 'bg-green-500/10 text-green-500 animate-pulse' : 'bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-black'}`}
                                                            title={`Update to ${updates[shader.projectId].newVersionNumber}`}
                                                        >
                                                            {updatingMod === shader.projectId ? (
                                                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleDeleteMod(shader.name, 'shader')} className="text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col">
                                <form onSubmit={handleSearch} className="flex gap-3 mb-6">
                                    <div className="flex-1 relative">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search Modrinth..."
                                            className="w-full bg-background-dark border border-white/10 rounded-xl p-3 pl-10 text-white focus:border-primary outline-none shadow-inner"
                                            autoFocus
                                        />
                                    </div>
                                    <button type="submit" className="bg-white/5 hover:bg-primary hover:text-black text-white font-bold px-6 rounded-xl border border-white/5 transition-all">Search</button>
                                </form>

                                <div className="flex justify-between items-center mb-4">
                                    <div className="text-sm text-gray-400">
                                        Showing {searchResults.length} results
                                    </div>
                                    <div className="w-48">
                                        <Dropdown
                                            options={[
                                                { value: 'relevance', label: 'Relevance' },
                                                { value: 'downloads', label: 'Downloads' },
                                                { value: 'newest', label: 'Newest' },
                                                { value: 'updated', label: 'Recently Updated' }
                                            ]}
                                            value={sortMethod}
                                            onChange={setSortMethod}
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                                    {searching ? (
                                        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                                    ) : searchResults.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                                            <div className="text-4xl mb-4">🔍</div>
                                            <p>No results found for "{searchQuery}"</p>
                                        </div>
                                    ) : (
                                        searchResults.map(result => (
                                            <div key={result.project_id} className="bg-surface p-4 rounded-xl flex items-center gap-4 border border-white/5 hover:border-primary/50 transition-colors cursor-pointer" onClick={() => handleViewProject(result)}>
                                                <img src={result.icon_url || 'https://cdn.modrinth.com/placeholder.svg'} alt="" className="w-12 h-12 rounded-lg bg-background-dark" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-lg text-white truncate">{result.title}</h3>
                                                        <span className="text-[10px] bg-background-dark text-gray-400 px-1.5 py-0.5 rounded border border-white/5">{result.project_type}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-400 line-clamp-1">{result.description}</p>
                                                    {result.project_type === 'shader' && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handlePreview(result); }}
                                                            className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1 rounded-lg mt-2 border border-white/5 flex items-center gap-2 transition-colors w-fit"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                            Preview
                                                        </button>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleInstall(result); }}
                                                    disabled={installationStatus[result.project_id] === 'installing' || installationStatus[result.project_id] === 'success'}
                                                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all border border-white/5 flex items-center gap-2 ${installationStatus[result.project_id] === 'success' ? 'bg-[#10b981] text-white shadow-[#10b981]/20' :
                                                        installationStatus[result.project_id] === 'failed' ? 'bg-red-500/20 text-red-500' :
                                                            installationStatus[result.project_id] === 'installing' ? 'bg-white/10 text-gray-400 cursor-wait' :
                                                                'bg-white/5 hover:bg-primary hover:text-black text-white'
                                                        }`}
                                                    title="Install latest version"
                                                >
                                                    {installationStatus[result.project_id] === 'installing' ? (
                                                        <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                    ) : installationStatus[result.project_id] === 'success' ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                    ) : installationStatus[result.project_id] === 'failed' ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                    )}
                                                    {installationStatus[result.project_id] === 'installing' ? 'Installing...' :
                                                        installationStatus[result.project_id] === 'success' ? 'Installed' :
                                                            installationStatus[result.project_id] === 'failed' ? 'Failed' : 'Install'}
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Pagination Controls */}
                                <div className="flex justify-between items-center bg-surface p-2 rounded-xl border border-white/5 shrink-0 mt-4 mb-2">
                                    <button
                                        onClick={handlePrevPage}
                                        disabled={searchOffset === 0 || searching}
                                        className={`px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-bold text-xs flex items-center gap-2 ${searchOffset === 0 ? 'invisible' : ''}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                        Previous
                                    </button>
                                    <div className="flex flex-col items-center">
                                        <span className="text-white font-bold text-sm">
                                            {Math.floor(searchOffset / limit) + 1}
                                        </span>
                                        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                                            of {Math.ceil(totalHits / limit) || 1} Pages
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleNextPage}
                                        disabled={searchOffset + limit >= totalHits || searching}
                                        className={`px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-bold text-xs flex items-center gap-2 ${searchOffset + limit >= totalHits ? 'invisible' : ''}`}
                                    >
                                        Next
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )
                }
                {
                    activeTab === 'worlds' && (
                        <div className="grid grid-cols-1 gap-3">
                            {worlds.length === 0 ? (
                                <div className="text-center text-gray-500 py-20 flex flex-col items-center">
                                    <div className="text-4xl mb-4">🌍</div>
                                    <p>No worlds found.</p>
                                </div>
                            ) : (
                                worlds.map(world => (
                                    <div key={world.name} className="p-4 bg-surface rounded-xl border border-white/5 hover:border-white/10 flex items-center gap-4 group cursor-pointer transition-colors" title={world.name}>
                                        <div className="w-12 h-12 bg-green-900/20 text-green-400 rounded-lg flex items-center justify-center text-2xl group-hover:bg-primary-hover/30 transition-colors">🌍</div>
                                        <div className="font-bold text-lg text-white truncate flex-1">{world.name}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    )
                }
                {
                    activeTab === 'logs' && (
                        <div
                            className="flex flex-col h-full bg-background-dark rounded-xl border border-white/5 overflow-hidden shadow-inner"
                            style={{ backgroundColor: 'rgba(var(--background-dark-color-rgb, 17, 17, 17), var(--console-opacity, 0.8))' }}
                        >
                            {/* Controls */}
                            <div className="flex items-center justify-between p-2 bg-surface/50 border-b border-white/5">
                                <div className="relative w-48">
                                    <Dropdown
                                        options={[
                                            { value: 'latest.log', label: 'latest.log' },
                                            ...logFiles.filter(f => f !== 'latest.log').map(f => ({ value: f, label: f }))
                                        ]}
                                        value={selectedLog}
                                        onChange={setSelectedLog}
                                        className=""
                                    />
                                </div>

                                <div className="flex gap-4">
                                    {['Info', 'Warn', 'Error', 'Debug'].map(level => (
                                        <label key={level} className="flex items-center gap-2 cursor-pointer select-none group">
                                            <div className={`w-3 h-3 rounded flex items-center justify-center border ${logFilters[level.toLowerCase()] ? 'bg-primary border-primary' : 'border-gray-600 bg-transparent'}`}>
                                                {logFilters[level.toLowerCase()] && <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={logFilters[level.toLowerCase()]}
                                                onChange={() => setLogFilters(prev => ({ ...prev, [level.toLowerCase()]: !prev[level.toLowerCase()] }))}
                                                className="hidden"
                                            />
                                            <span className={`text-xs font-bold uppercase ${logFilters[level.toLowerCase()] ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>{level}</span>
                                        </label>
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer select-none group mr-2">
                                        <div className={`w-3 h-3 rounded flex items-center justify-center border ${autoScroll ? 'bg-primary border-primary' : 'border-gray-600 bg-transparent'}`}>
                                            {autoScroll && <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={autoScroll}
                                            onChange={() => setAutoScroll(prev => !prev)}
                                            className="hidden"
                                        />
                                        <span className={`text-xs font-bold uppercase ${autoScroll ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>Auto-Scroll</span>
                                    </label>
                                    <button onClick={() => { loadLogFiles(); loadLog(); }} className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-gray-300 uppercase tracking-wide border border-white/5 transition-colors">Refresh</button>
                                    <button onClick={handleCopyLog} className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-gray-300 uppercase tracking-wide border border-white/5 transition-colors">Copy</button>
                                    <button onClick={() => setLog('')} className="px-3 py-1 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-xs font-bold text-gray-300 uppercase tracking-wide border border-white/5 transition-colors">Clear</button>
                                </div>
                            </div>

                            {/* Log Display */}
                            <div ref={logContainerRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs text-gray-300 custom-scrollbar">
                                {getFilteredLog().length > 0 ? getFilteredLog().map((line, i) => (
                                    <div key={i} className={`whitespace-pre-wrap leading-relaxed py-0.5 border-b border-transparent hover:bg-white/5 ${line.toLowerCase().includes('error') ? 'text-red-400 font-bold' : line.toLowerCase().includes('warn') ? 'text-yellow-400' : 'text-gray-400'}`}>
                                        {line}
                                    </div>
                                )) : (
                                    <div className="text-gray-600 italic text-center mt-20">No active log entries.</div>
                                )}
                            </div>
                        </div>
                    )
                }
            </div >
            {
                showSettings && (
                    <InstanceSettingsModal
                        instance={instance}
                        onClose={() => setShowSettings(false)}
                        onSave={handleSettingsSave}
                        onDelete={onBack}
                    />
                )
            }

            {/* Modrinth Project Versions Modal */}
            {
                selectedProject && (
                    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8 backdrop-blur-sm" onClick={() => setSelectedProject(null)}>
                        <div className="bg-background-dark w-full max-w-3xl max-h-[80vh] rounded-xl border border-white/10 flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                            {/* Header */}
                            <div className="p-6 border-b border-white/5 flex items-center gap-4">
                                <img src={selectedProject.icon_url || 'https://cdn.modrinth.com/placeholder.svg'} alt="" className="w-16 h-16 rounded-xl bg-surface" />
                                <div className="flex-1">
                                    <h2 className="text-2xl font-bold">{selectedProject.title}</h2>
                                    <p className="text-gray-400 text-sm">{selectedProject.description}</p>
                                </div>
                                <button onClick={() => setSelectedProject(null)} className="text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-lg transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            {/* Versions List */}
                            <div className="flex-1 overflow-y-auto p-4">
                                {loadingVersions ? (
                                    <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                                ) : projectVersions.length === 0 ? (
                                    <div className="text-center text-gray-500 py-20">No versions found</div>
                                ) : (
                                    <div className="space-y-2">
                                        {projectVersions.map(version => {
                                            const isCompatible = version.game_versions?.includes(instance.version) && version.loaders?.some(l => l.toLowerCase() === instance.loader?.toLowerCase());
                                            return (
                                                <div key={version.id} className={`p-4 rounded-xl border flex items-center gap-4 ${isCompatible ? 'bg-surface border-primary/30' : 'bg-surface/50 border-white/5'}`}>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-bold text-white">{version.version_number}</span>
                                                            <span className={`text-xs px-2 py-0.5 rounded ${version.version_type === 'release' ? 'bg-green-500/20 text-green-400' : version.version_type === 'beta' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                                                                {version.version_type}
                                                            </span>
                                                            {isCompatible && <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">Compatible</span>}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
                                                            <span>MC: {version.game_versions?.slice(0, 5).join(', ')}{version.game_versions?.length > 5 ? '...' : ''}</span>
                                                            <span>|</span>
                                                            <span>{version.loaders?.join(', ')}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleInstallVersion(version)}
                                                        className="bg-white/5 hover:bg-primary hover:text-black text-white px-4 py-2 rounded-lg font-bold text-sm transition-all border border-white/5 flex items-center gap-2 shrink-0"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                        Install
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Preview Modal */}
            {showPreviewModal && previewProject && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-surface w-full max-w-5xl h-[85vh] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-scale-in">
                        {/* Header */}
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

                        {/* Gallery Content */}
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

                        {/* Footer Actions */}
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
                                    handleInstall(previewProject);
                                }}
                                disabled={installationStatus[previewProject.project_id] === 'installing' || installationStatus[previewProject.project_id] === 'success'}
                                className={`font-bold px-8 py-3 rounded-xl hover:scale-105 transition-all shadow-lg flex items-center gap-2 ${installationStatus[previewProject.project_id] === 'success'
                                    ? 'bg-[#10b981] text-white shadow-[#10b981]/20'
                                    : 'bg-primary text-black shadow-primary/20 hover:bg-primary-hover'
                                    }`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                </svg>
                                {installationStatus[previewProject.project_id] === 'success' ? 'Installed' : 'Install'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Gallery Lightbox Slider */}
            {lightboxIndex !== -1 && previewProject && previewProject.gallery && (
                <div
                    className="fixed inset-0 bg-black/95 z-[210] flex items-center justify-center animate-fade-in backdrop-blur-xl select-none"
                    onClick={() => setLightboxIndex(-1)}
                >
                    {/* Close Button */}
                    <button
                        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50"
                        onClick={() => setLightboxIndex(-1)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Navigation Buttons */}
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

                    {/* Image Counter */}
                    <div className="absolute top-6 left-6 text-white font-bold bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
                        {lightboxIndex + 1} / {previewProject.gallery.length}
                    </div>

                    {/* Main Image */}
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
            )}
            {
                modToDelete && (
                    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-surface-dark border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                            <h3 className="text-xl font-bold mb-2">Delete Mod?</h3>
                            <p className="text-gray-400 text-sm mb-6">Are you sure you want to delete <span className="text-white font-mono">{modToDelete.name}</span>? This action cannot be undone.</p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setModToDelete(null)}
                                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteMod}
                                    className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white font-bold transition-colors shadow-lg shadow-red-500/20"
                                >
                                    Delete Mod
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}

export default InstanceDetails;