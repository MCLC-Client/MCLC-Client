import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Dropdown from '../components/Dropdown';
import { useNotification } from '../context/NotificationContext';
import LoadingOverlay from '../components/LoadingOverlay';
import ConfirmationModal from '../components/ConfirmationModal';
import { Analytics } from '../services/Analytics';
import ModpackCodeModal from '../components/ModpackCodeModal';

const DEFAULT_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'%3E%3C/path%3E%3Cpolyline points='3.27 6.96 12 12.01 20.73 6.96'%3E%3C/polyline%3E%3Cline x1='12' y1='22.08' x2='12' y2='12'%3E%3C/line%3E%3C/svg%3E";

// Format playtime from milliseconds to readable string
const formatPlaytime = (ms) => {
    if (!ms || ms <= 0) return '0h';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

function Dashboard({ onInstanceClick, runningInstances = {}, triggerCreate, onCreateHandled }) {
    const { addNotification } = useNotification();
    const [instances, setInstances] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Handle external create trigger from sidebar + button
    useEffect(() => {
        if (triggerCreate) {
            setShowCreateModal(true);
            if (onCreateHandled) onCreateHandled();
        }
    }, [triggerCreate]);
    const [contextMenu, setContextMenu] = useState(null); // { x, y, instance }
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [instanceToDelete, setInstanceToDelete] = useState(null);

    // Create Instance State
    const [newInstanceName, setNewInstanceName] = useState('');
    const [selectedVersion, setSelectedVersion] = useState('');
    const [selectedLoader, setSelectedLoader] = useState('Vanilla');
    const [newInstanceIcon, setNewInstanceIcon] = useState(DEFAULT_ICON);

    const [availableVersions, setAvailableVersions] = useState([]);
    const [loadingVersions, setLoadingVersions] = useState(false);

    const [isCreating, setIsCreating] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // Global loading state for overlay

    // Multi-step creation
    const [creationStep, setCreationStep] = useState(1);
    const [loaderVersions, setLoaderVersions] = useState([]);
    const [selectedLoaderVersion, setSelectedLoaderVersion] = useState('');
    const [availableLoaders, setAvailableLoaders] = useState({ Vanilla: true, Fabric: true, Forge: true, NeoForge: true, Quilt: true });
    const [checkingLoaders, setCheckingLoaders] = useState(false);
    const [pendingLaunches, setPendingLaunches] = useState({}); // { [name]: boolean }
    const [installProgress, setInstallProgress] = useState({}); // { [name]: { progress, status } }
    const [searchQuery, setSearchQuery] = useState('');
    const [sortMethod, setSortMethod] = useState('playtime'); // name, version, playtime
    const [groupMethod, setGroupMethod] = useState('version'); // none, version, loader

    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const [showModalImportMenu, setShowModalImportMenu] = useState(false);
    const [showCodeModal, setShowCodeModal] = useState(false);
    const createMenuRef = useRef(null);
    const internalImportMenuRef = useRef(null);

    // File Input Ref
    const fileInputRef = useRef(null);

    // Handle clicks outside the dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (createMenuRef.current && !createMenuRef.current.contains(event.target)) {
                setShowCreateMenu(false);
            }
            if (internalImportMenuRef.current && !internalImportMenuRef.current.contains(event.target)) {
                setShowModalImportMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCodeImportComplete = async (modpackData) => {
        addNotification(`Starting background import for "${modpackData.name}"...`, 'info');

        try {
            // First create the instance
            const createRes = await window.electronAPI.createInstance(
                modpackData.name,
                modpackData.instanceVersion || modpackData.version,
                modpackData.instanceLoader || modpackData.loader,
                null // Default icon
            );

            if (createRes.success) {
                const instanceName = createRes.instanceName;

                // Initialize install progress immediately
                setInstallProgress(prev => ({
                    ...prev,
                    [instanceName]: { progress: 0, status: 'Starting import...' }
                }));

                // Trigger background installation of mods, packs, shaders, and keybinds
                window.electronAPI.installSharedContent(instanceName, modpackData);

                addNotification(`Instance "${instanceName}" created. Download starting in the background.`, 'success');
                loadInstances(); // Refresh the list
            } else {
                addNotification(`Failed to create instance: ${createRes.error}`, 'error');
            }
        } catch (error) {
            console.error('Code import error:', error);
            addNotification(`Error during import: ${error.message}`, 'error');
        }
    };

    useEffect(() => {
        loadInstances();

        // Installation Progress Listener
        const removeInstallListener = window.electronAPI.onInstallProgress((data) => {
            setInstallProgress(prev => {
                if (data.progress >= 100) {
                    const next = { ...prev };
                    delete next[data.instanceName];
                    return next;
                }
                return { ...prev, [data.instanceName]: data };
            });
            // Also refresh list if complete
            if (data.progress >= 100) {
                loadInstances();
            }
        });

        // Also refresh when instance status changes (e.g., install completes)
        const removeListener = window.electronAPI.onInstanceStatus(({ instanceName, status }) => {
            if (status === 'stopped' || status === 'ready' || status === 'error' || status === 'deleted') {
                loadInstances();
            }
        });

        return () => {
            if (removeListener) removeListener();
            if (removeInstallListener) removeInstallListener();
        };
    }, []);

    useEffect(() => {
        if (showCreateModal) {
            fetchVersions();
            setNewInstanceName('');
            setNewInstanceIcon(DEFAULT_ICON);
            setSelectedLoader('Vanilla');
            setIsCreating(false);
            setCreationStep(1);
            setLoaderVersions([]);
            setSelectedLoaderVersion('');
            setAvailableLoaders({ Vanilla: true, Fabric: true, Forge: true, NeoForge: true, Quilt: true });
        }
    }, [showCreateModal]);

    // Fetch versions when Modal opens or Loader changes
    const [showSnapshots, setShowSnapshots] = useState(false);

    useEffect(() => {
        if (!showCreateModal) return;

        const updateVersions = async () => {
            setLoadingVersions(true);
            try {
                if (selectedLoader === 'Vanilla') {
                    const res = await window.electronAPI.getVanillaVersions();
                    if (res.success) {
                        // Filter based on showSnapshots
                        const versions = res.versions.filter(v => showSnapshots ? true : v.type === 'release');
                        setAvailableVersions(versions);

                        if (versions.length > 0 && (!selectedVersion || !versions.find(v => v.id === selectedVersion))) {
                            setSelectedVersion(versions[0].id);
                        }
                    }
                } else {
                    // Modded Loader
                    const res = await window.electronAPI.getSupportedGameVersions(selectedLoader);
                    if (res.success) {
                        let versions = res.versions;

                        // Filter invalid/snapshot versions if toggle is off
                        if (!showSnapshots) {
                            versions = versions.filter(v => /^\d+\.\d+(\.\d+)?$/.test(v));
                        }

                        // Convert to object array
                        const versionObjs = versions.map(v => ({ id: v, type: 'release' })); // Type is dummy here
                        setAvailableVersions(versionObjs);

                        if (versionObjs.length > 0 && (!selectedVersion || !versionObjs.find(v => v.id === selectedVersion))) {
                            setSelectedVersion(versionObjs[0].id);
                        } else if (versionObjs.length === 0) {
                            setSelectedVersion('');
                        }
                    } else {
                        addNotification(`Failed to get versions for ${selectedLoader}: ${res.error}`, 'error');
                        setAvailableVersions([]); // clear
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingVersions(false);
            }
        };

        updateVersions();
    }, [showCreateModal, selectedLoader, showSnapshots]);

    const loadInstances = async () => {
        const list = await window.electronAPI.getInstances();
        setInstances(list || []);
    };

    const fetchVersions = async () => {
        setLoadingVersions(true);
        const res = await window.electronAPI.getVanillaVersions();
        setLoadingVersions(false);
        if (res.success) {
            // Only show release versions, no snapshots
            const versions = res.versions.filter(v => v.type === 'release');
            setAvailableVersions(versions);
            if (versions.length > 0) setSelectedVersion(versions[0].id);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (isCreating) return;

        const loaderForApi = selectedLoader.toLowerCase();

        // Step 1: If Modded and not yet on step 2, go to Step 2
        if (creationStep === 1 && loaderForApi !== 'vanilla') {
            if (!selectedVersion) {
                addNotification('Please select a Minecraft version', 'error');
                return;
            }

            setLoadingVersions(true);
            try {
                const res = await window.electronAPI.getLoaderVersions(loaderForApi, selectedVersion);
                setLoadingVersions(false);

                if (res.success && res.versions && res.versions.length > 0) {
                    setLoaderVersions(res.versions);
                    // Usually first one is latest, extract the version string
                    setSelectedLoaderVersion(res.versions[0].version);
                    setCreationStep(2);
                    return; // Stop here, wait for user to confirm step 2
                } else {
                    addNotification('No specific loader versions found, using latest.', 'info');
                    // Proceed to create with default (null loaderVersion)
                }
            } catch (err) {
                setLoadingVersions(false);
                addNotification('Failed to fetch loader versions: ' + err.message, 'error');
                return;
            }
        }

        performCreation();
    };

    const performCreation = async () => {
        setIsCreating(true);
        const nameToUse = newInstanceName.trim() || "New Instance";
        const loaderForApi = selectedLoader.toLowerCase();

        try {
            const result = await window.electronAPI.createInstance(
                nameToUse,
                selectedVersion,
                loaderForApi,
                newInstanceIcon,
                creationStep === 2 ? selectedLoaderVersion : null
            );

            if (result.success) {
                // Modal closes immediately, background install happens
                setShowCreateModal(false);
                await loadInstances();
                addNotification(`Started creating: ${result.instanceName || nameToUse}`, 'success');

                // Track in Analytics
                Analytics.trackInstanceCreation(loaderForApi, selectedVersion);
            } else {
                addNotification(`Failed to create instance: ${result.error}`, 'error');
            }
        } catch (err) {
            addNotification(`Error creating instance: ${err.message}`, 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewInstanceIcon(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // Handle context menu
    const handleContextMenu = (e, instance) => {
        e.preventDefault();
        e.stopPropagation();

        // Calculate position with boundary checks
        const menuWidth = 180;
        const menuHeight = 280;
        let x = e.clientX;
        let y = e.clientY;

        // Prevent menu from going off-screen
        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth - 10;
        }
        if (y + menuHeight > window.innerHeight) {
            y = window.innerHeight - menuHeight - 10;
        }

        setContextMenu({ x, y, instance });
    };

    const handleContextAction = async (action) => {
        const instance = contextMenu?.instance;
        if (!instance) return;
        setContextMenu(null);

        switch (action) {
            case 'play':
                window.electronAPI.launchGame(instance.name);
                break;
            case 'view':
                onInstanceClick(instance);
                break;
            case 'duplicate':
                try {
                    const result = await window.electronAPI.duplicateInstance(instance.name);
                    if (result.success) {
                        addNotification(`Duplicated instance: ${instance.name}`, 'success');
                        await loadInstances();
                    } else {
                        addNotification(`Duplicate failed: ${result.error}`, 'error');
                    }
                } catch (e) {
                    addNotification(`Duplicate failed: ${e.message}`, 'error');
                }
                break;
            case 'export':
                try {
                    const exportResult = await window.electronAPI.exportInstance(instance.name);
                    if (exportResult.success) {
                        addNotification(`Exported to ${exportResult.path}`, 'success');
                    } else if (exportResult.error !== 'Cancelled') {
                        addNotification(`Export failed: ${exportResult.error}`, 'error');
                    }
                } catch (e) {
                    addNotification(`Export failed: ${e.message}`, 'error');
                }
                break;
            case 'folder':
                window.electronAPI.openInstanceFolder(instance.name);
                break;
            case 'delete':
                setInstanceToDelete(instance);
                setShowDeleteModal(true);
                break;
        }
    };

    const handleDeleteConfirm = async () => {
        if (!instanceToDelete) return;

        setIsLoading(true);
        try {
            // Stop the instance if it's running
            const status = runningInstances[instanceToDelete.name];
            if (status) {
                await window.electronAPI.killGame(instanceToDelete.name);
                addNotification(`Stopped ${instanceToDelete.name}`, 'info');
            }
            await window.electronAPI.deleteInstance(instanceToDelete.name);
            addNotification(`Deleted instance: ${instanceToDelete.name}`, 'info');
            await loadInstances();
        } catch (e) {
            addNotification(`Failed to delete: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
            setShowDeleteModal(false);
            setInstanceToDelete(null);
        }
    };

    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Prepare dropdown options
    const versionOptions = availableVersions.map(v => ({
        value: v.id,
        label: v.id
    }));

    const loaderOptions = [
        { value: 'Vanilla', label: 'Vanilla' },
        { value: 'Fabric', label: 'Fabric' },
        { value: 'Forge', label: 'Forge' },
        { value: 'NeoForge', label: 'NeoForge' },
        { value: 'Quilt', label: 'Quilt' }
    ];

    const sortOptions = [
        { value: 'name', label: 'Sort by: Name' },
        { value: 'version', label: 'Sort by: Game version' },
        { value: 'playtime', label: 'Sort by: Playtime' }
    ];

    const groupOptions = [
        { value: 'none', label: 'Group by: None' },
        { value: 'version', label: 'Group by: Game version' },
        { value: 'loader', label: 'Group by: Loader' }
    ];

    // 1. Filter
    const filteredInstances = instances.filter(inst =>
        inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.version.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // 2. Sort
    const sortedInstances = [...filteredInstances].sort((a, b) => {
        if (sortMethod === 'name') return a.name.localeCompare(b.name);
        if (sortMethod === 'playtime') return (b.playtime || 0) - (a.playtime || 0);
        if (sortMethod === 'version') {
            // Simple version sort (reverse release order usually)
            return b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' });
        }
        return 0;
    });

    // 3. Group
    const groupedData = [];
    if (groupMethod === 'none') {
        groupedData.push({ title: null, items: sortedInstances });
    } else {
        const groups = {};
        sortedInstances.forEach(inst => {
            const key = groupMethod === 'version' ? inst.version : (inst.loader || 'Vanilla');
            if (!groups[key]) groups[key] = [];
            groups[key].push(inst);
        });

        // Sort keys for consistent display
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            if (groupMethod === 'version') return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
            return a.localeCompare(b);
        });

        sortedKeys.forEach(key => {
            groupedData.push({ title: key, items: groups[key] });
        });
    }

    return (
        <>
            <div className="p-8 h-full flex flex-col">
                {isLoading && <LoadingOverlay message="Processing..." />}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">Library</h1>
                        <p className="text-gray-400 text-sm">Manage your instances</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="text"
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-background border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all w-64"
                            />
                        </div>
                        <div className="w-48">
                            <Dropdown options={sortOptions} value={sortMethod} onChange={setSortMethod} />
                        </div>
                        <div className="w-48">
                            <Dropdown options={groupOptions} value={groupMethod} onChange={setGroupMethod} />
                        </div>

                        {/* New Instance Dropdown */}
                        <div className="relative" ref={createMenuRef}>
                            <button
                                onClick={() => setShowCreateMenu(!showCreateMenu)}
                                className="bg-primary hover:bg-primary-hover text-black font-bold px-6 py-2.5 rounded-xl shadow-primary-glow transition-all transform hover:scale-105 flex items-center gap-2 text-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                New Instance
                                <svg className={`w-4 h-4 transition-transform ${showCreateMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {showCreateMenu && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-100">
                                    <button
                                        onClick={() => {
                                            setShowCreateModal(true);
                                            setShowCreateMenu(false);
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 transition-colors text-sm"
                                    >
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        Manual Creation
                                    </button>
                                    <div className="h-px bg-white/5 my-1"></div>
                                    <button
                                        onClick={async () => {
                                            setShowCreateMenu(false);
                                            const result = await window.electronAPI.importMrPack();
                                            if (result.success) {
                                                addNotification(`Importing Modpack: ${result.instanceName}...`, 'info');
                                                loadInstances();
                                            } else if (result.error !== 'Cancelled') {
                                                addNotification(`Import failed: ${result.error}`, 'error');
                                            }
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 transition-colors text-sm"
                                    >
                                        <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="currentColor"><path d="M12.551 2c-1.397.01-2.731.332-3.926.892L3.196 5.37a2.035 2.035 0 0 0-.916 2.766l2.42 4.192c-.221.734-.37 1.48-.445 2.238l-4.148 1.408A2.035 2.035 0 0 0 0 17.893V22.8c.002.54.218 1.056.6 1.436.381.38.897.597 1.437.599h19.926c1.124 0 2.037-.912 2.037-2.037v-4.907c0-.986-.703-1.83-1.637-2.001l-4.148-1.408c-.075-.757-.224-1.504-.445-2.238l2.42-4.192a2.035 2.035 0 0 0-.916-2.766l-5.429-2.478c-1.192-.558-2.525-.88-3.923-.89zm-.06.772c1.284.009 2.502.296 3.593.805l5.428 2.478a1.264 1.264 0 0 1 .57 1.719l-2.422 4.193a12.82 12.82 0 0 1 .496 2.493l4.148 1.406a1.264 1.264 0 0 1 .818 1.157V22.8c-.001.333-.135.654-.37.89-.236.236-.557.37-.891.371H14.162c.328-.507.502-1.096.502-1.706V16.35c0-1.706-1.383-3.089-3.089-3.089-1.706 0-3.089 1.383-3.089 3.089V22.355c0 .61.174 1.199.502 1.706H2.126c-.334-.001-.655-.135-.891-.371a1.26 1.26 0 0 1-.371-.89v-4.907c0-.332.134-.653.37-.889l4.148-1.406a12.82 12.82 0 0 1 .496-2.493L3.456 6.055a1.264 1.264 0 0 1 .57-1.719l5.428-2.478c1.091-.509 2.31-.796 3.593-.805zM11.575 14.033c.966 0 1.748.783 1.748 1.748V22.355c0 .965-.782 1.748-1.748 1.748-.965 0-1.748-.783-1.748-1.748V15.781c0-.965.783-1.748 1.748-1.748z" /></svg>
                                        Import .mrpack (Modrinth)
                                    </button>
                                    <button
                                        onClick={async () => {
                                            setShowCreateMenu(false);
                                            const result = await window.electronAPI.importInstance();
                                            if (result.success) {
                                                addNotification(`Imported instance: ${result.instanceName}`, 'success');
                                                loadInstances();
                                            } else if (result.error !== 'Cancelled') {
                                                addNotification(`Import failed: ${result.error}`, 'error');
                                            }
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 transition-colors text-sm"
                                    >
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        Import .mcpack (Client)
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowCreateMenu(false);
                                            setShowCodeModal(true);
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 transition-colors text-sm"
                                    >
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                        Import from Code
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pb-20 pr-1">
                    {groupedData.map((group, gIdx) => (
                        <div key={group.title || 'all'} className={gIdx > 0 ? 'mt-3' : ''}>
                            {group.title && (
                                <div className="flex items-center gap-4 mb-4">
                                    <span className="text-white font-bold text-sm whitespace-nowrap opacity-80">{group.title}</span>
                                    <div className="h-px bg-white/10 flex-1"></div>
                                </div>
                            )}
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 mb-8">
                                {group.items.map((instance) => {
                                    // Use runningInstances from props first, fallback to persisted status
                                    const liveStatus = runningInstances[instance.name];
                                    const persistedStatus = instance.status;
                                    const installState = installProgress[instance.name];

                                    // liveStatus takes priority, but if not present, check if instance is still installing
                                    // installState ensures we catch the transient installing state even if not persisted yet
                                    const status = liveStatus || (installState || persistedStatus === 'installing' ? 'installing' : null);
                                    const isRunning = status === 'running';
                                    const isLaunching = status === 'launching';
                                    const isInstalling = status === 'installing';

                                    return (
                                        <div
                                            key={instance.name}
                                            onClick={() => onInstanceClick(instance)}
                                            onContextMenu={(e) => handleContextMenu(e, instance)}
                                            className={`group bg-surface/40 backdrop-blur-sm border rounded-xl p-4 transition-all cursor-pointer relative overflow-hidden shadow-lg hover:shadow-xl hover:shadow-black/50 ${isRunning ? 'border-primary/50 ring-1 ring-primary/20' : 'border-white/5 hover:border-primary/50'}`}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-40 transition-opacity"></div>

                                            {/* 3-dot menu button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleContextMenu(e, instance);
                                                }}
                                                className="absolute top-3 right-3 z-20 w-8 h-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                                            >
                                                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                </svg>
                                            </button>

                                            <div className="flex items-start gap-4 mb-3 relative z-10">
                                                <div className="w-16 h-16 bg-background rounded-lg flex items-center justify-center text-4xl shadow-inner border border-white/5 overflow-hidden">
                                                    {instance.icon && instance.icon.startsWith('data:') ? (
                                                        <img src={instance.icon} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-lg text-white truncate group-hover:text-primary transition-colors">{instance.name}</h3>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                        <span className="bg-white/5 px-2 py-0.5 rounded capitalize border border-white/5">{instance.loader || 'Vanilla'}</span>
                                                        <span>{instance.version}</span>
                                                    </div>
                                                    {status && status !== 'ready' && status !== 'stopped' && (
                                                        <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-primary animate-pulse">
                                                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                                                            {isInstalling ? (installState ? `Installing (${installState.progress}%)` : 'Installing...') : isLaunching ? 'Launching...' : 'Running'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5 relative z-10">
                                                <span className="text-xs text-gray-500 font-mono flex items-center gap-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                                                    {formatPlaytime(instance.playtime)}
                                                </span>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (isRunning) {
                                                            window.electronAPI.killGame(instance.name);
                                                            addNotification(`Stopping ${instance.name}...`, 'info');
                                                        } else if (!isInstalling && !isLaunching && !pendingLaunches[instance.name]) {
                                                            setPendingLaunches(prev => ({ ...prev, [instance.name]: true }));
                                                            try {
                                                                const result = await window.electronAPI.launchGame(instance.name);
                                                                if (!result.success) {
                                                                    addNotification(`Launch failed: ${result.error}`, 'error');
                                                                } else {
                                                                    addNotification(`Launching ${instance.name}...`, 'info');
                                                                }
                                                            } catch (err) {
                                                                addNotification(`Launch error: ${err.message}`, 'error');
                                                            } finally {
                                                                setPendingLaunches(prev => {
                                                                    const next = { ...prev };
                                                                    delete next[instance.name];
                                                                    return next;
                                                                });
                                                            }
                                                        }
                                                    }}
                                                    className={`w-10 h-10 rounded-full flex items-center justify-center transform transition-all duration-300 shadow-lg z-20 ${isRunning ? 'bg-red-500 hover:bg-red-400 text-white opacity-100' : (isInstalling || isLaunching || pendingLaunches[instance.name]) ? 'bg-gray-700 text-gray-400 cursor-wait opacity-100' : 'bg-primary text-black opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 hover:bg-primary-hover hover:scale-110'}`}
                                                    title={isRunning ? "Stop" : isInstalling ? (installState ? installState.status : "Installing...") : isLaunching ? "Launching..." : pendingLaunches[instance.name] ? "Starting..." : "Launch Game"}
                                                    disabled={isInstalling || isLaunching || pendingLaunches[instance.name]}
                                                >
                                                    {isRunning ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><rect x="6" y="6" width="8" height="8" rx="1" /></svg>
                                                    ) : (isInstalling || isLaunching || pendingLaunches[instance.name]) ? (
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {groupedData.length === 0 || (groupedData.length === 1 && groupedData[0].items.length === 0) ? (
                    <div className="col-span-full py-20 text-center text-gray-500 border-2 border-white/5 border-dashed rounded-xl flex flex-col items-center justify-center">
                        <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        <p className="text-xl font-medium mb-2 text-gray-400">No instances found</p>
                        <p className="text-sm">Create a new instance to start playing</p>
                    </div>
                ) : null}
            </div>

            {contextMenu && createPortal(
                <div
                    className="fixed bg-surface border border-white/10 rounded-lg shadow-2xl py-2 z-[9999] min-w-[180px]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={() => handleContextAction('play')} className="w-full px-4 py-2 text-left hover:bg-white/5 flex items-center gap-3 text-sm">
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                        Play
                    </button>
                    <div className="border-t border-white/5 my-1"></div>
                    <button onClick={() => handleContextAction('view')} className="w-full px-4 py-2 text-left hover:bg-white/5 flex items-center gap-3 text-sm">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        View instance
                    </button>
                    <button onClick={() => handleContextAction('duplicate')} className="w-full px-4 py-2 text-left hover:bg-white/5 flex items-center gap-3 text-sm">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Duplicate
                    </button>
                    <button onClick={() => handleContextAction('export')} className="w-full px-4 py-2 text-left hover:bg-white/5 flex items-center gap-3 text-sm">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Export
                    </button>
                    <button onClick={() => handleContextAction('folder')} className="w-full px-4 py-2 text-left hover:bg-white/5 flex items-center gap-3 text-sm">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                        Open folder
                    </button>
                    <div className="border-t border-white/5 my-1"></div>
                    <button onClick={() => handleContextAction('delete')} className="w-full px-4 py-2 text-left hover:bg-red-500/20 text-red-400 flex items-center gap-3 text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete
                    </button>
                </div>,
                document.body
            )}

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-lg p-8 shadow-2xl transform transition-all scale-100">
                        <h2 className="text-2xl font-bold mb-6 text-white text-center">Create New Instance</h2>
                        <form onSubmit={handleCreate} className="space-y-6">
                            {creationStep === 1 && (
                                <>
                                    {/* Icon Selection */}
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-24 h-24 bg-background rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden relative group cursor-pointer hover:border-primary/50 transition-colors"
                                            onClick={() => fileInputRef.current?.click()}>
                                            <img src={newInstanceIcon} alt="Icon" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            </div>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleFileSelect}
                                                accept="image/*"
                                                className="hidden"
                                            />
                                        </div>
                                        <span className="text-xs text-gray-400 uppercase tracking-wide font-bold">Click to upload icon</span>
                                    </div>

                                    <div>
                                        <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">Name</label>
                                        <input
                                            type="text"
                                            value={newInstanceName}
                                            onChange={(e) => setNewInstanceName(e.target.value)}
                                            className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                            placeholder="New Instance"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="block text-gray-400 text-sm font-bold uppercase tracking-wide">Version</label>
                                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowSnapshots(!showSnapshots)}>
                                                    <div className={`w-8 h-4 rounded-full relative transition-colors ${showSnapshots ? 'bg-primary' : 'bg-gray-600'}`}>
                                                        <div className={`absolute top-0.5 bottom-0.5 w-3 h-3 bg-white rounded-full transition-all ${showSnapshots ? 'left-4.5' : 'left-0.5'}`} style={{ left: showSnapshots ? '18px' : '2px' }}></div>
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase">Dev Builds</span>
                                                </div>
                                            </div>
                                            {loadingVersions ? (
                                                <div className="p-3 text-gray-500 bg-background border border-white/10 rounded-xl">Loading...</div>
                                            ) : (
                                                <Dropdown
                                                    options={versionOptions}
                                                    value={selectedVersion}
                                                    onChange={setSelectedVersion}
                                                    placeholder="Select Version"
                                                />
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">Loader</label>
                                            <Dropdown
                                                options={loaderOptions}
                                                value={selectedLoader}
                                                onChange={setSelectedLoader}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {creationStep === 2 && (
                                <div>
                                    <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">Select {selectedLoader} Version</label>
                                    <Dropdown
                                        options={loaderVersions.map(v => ({ value: v.version, label: v.version }))}
                                        value={selectedLoaderVersion}
                                        onChange={setSelectedLoaderVersion}
                                        placeholder="Select Loader Version"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">Minecraft {selectedVersion}</p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                                {creationStep === 1 ? (
                                    <div className="relative" ref={internalImportMenuRef}>
                                        <button
                                            type="button"
                                            onClick={() => setShowModalImportMenu(!showModalImportMenu)}
                                            className="px-4 py-2 rounded-xl text-xs text-primary font-bold hover:bg-primary/10 transition-colors flex items-center gap-2 border border-primary/20"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            Import Options
                                            <svg className={`w-3 h-3 transition-transform ${showModalImportMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>

                                        {showModalImportMenu && (
                                            <div className="absolute left-0 bottom-full mb-2 w-56 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl z-[60] overflow-hidden py-2 animate-in fade-in slide-in-from-bottom-2 duration-100">
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        setShowModalImportMenu(false);
                                                        const result = await window.electronAPI.importMrPack();
                                                        if (result.success) {
                                                            addNotification(`Importing Modpack: ${result.instanceName}...`, 'info');
                                                            setShowCreateModal(false);
                                                            loadInstances();
                                                        } else if (result.error !== 'Cancelled') {
                                                            addNotification(`Import failed: ${result.error}`, 'error');
                                                        }
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 transition-colors text-xs text-gray-200"
                                                >
                                                    <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="currentColor"><path d="M12.551 2c-1.397.01-2.731.332-3.926.892L3.196 5.37a2.035 2.035 0 0 0-.916 2.766l2.42 4.192c-.221.734-.37 1.48-.445 2.238l-4.148 1.408A2.035 2.035 0 0 0 0 17.893V22.8c.002.54.218 1.056.6 1.436.381.38.897.597 1.437.599h19.926c1.124 0 2.037-.912 2.037-2.037v-4.907c0-.986-.703-1.83-1.637-2.001l-4.148-1.408c-.075-.757-.224-1.504-.445-2.238l2.42-4.192a2.035 2.035 0 0 0-.916-2.766l-5.429-2.478c-1.192-.558-2.525-.88-3.923-.89zm-.06.772c1.284.009 2.502.296 3.593.805l5.428 2.478a1.264 1.264 0 0 1 .57 1.719l-2.422 4.193a12.82 12.82 0 0 1 .496 2.493l4.148 1.406a1.264 1.264 0 0 1 .818 1.157V22.8c-.001.333-.135.654-.37.89-.236.236-.557.37-.891.371H14.162c.328-.507.502-1.096.502-1.706V16.35c0-1.706-1.383-3.089-3.089-3.089-1.706 0-3.089 1.383-3.089 3.089V22.355c0 .61.174 1.199.502 1.706H2.126c-.334-.001-.655-.135-.891-.371a1.26 1.26 0 0 1-.371-.89v-4.907c0-.332.134-.653.37-.889l4.148-1.406a12.82 12.82 0 0 1 .496-2.493L3.456 6.055a1.264 1.264 0 0 1 .57-1.719l5.428-2.478c1.091-.509 2.31-.796 3.593-.805zM11.575 14.033c.966 0 1.748.783 1.748 1.748V22.355c0 .965-.782 1.748-1.748 1.748-.965 0-1.748-.783-1.748-1.748V15.781c0-.965.783-1.748 1.748-1.748z" /></svg>
                                                    Modrinth .mrpack
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        setShowModalImportMenu(false);
                                                        const result = await window.electronAPI.importInstance();
                                                        if (result.success) {
                                                            addNotification(`Imported instance: ${result.instanceName}`, 'success');
                                                            setShowCreateModal(false);
                                                            loadInstances();
                                                        } else if (result.error !== 'Cancelled') {
                                                            addNotification(`Import failed: ${result.error}`, 'error');
                                                        }
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 transition-colors text-xs text-gray-200"
                                                >
                                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                    Client .mcpack
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowModalImportMenu(false);
                                                        setShowCreateModal(false);
                                                        setShowCodeModal(true);
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 transition-colors text-xs text-gray-200"
                                                >
                                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                                    Import from Code
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setCreationStep(1)}
                                        className="px-6 py-2 rounded-xl text-gray-400 font-bold hover:text-white hover:bg-white/5 transition-colors"
                                    >
                                        Back
                                    </button>
                                )}

                                <div className="flex gap-3 ml-auto">
                                    <button
                                        type="button"
                                        disabled={isCreating}
                                        onClick={() => setShowCreateModal(false)}
                                        className="px-6 py-2 rounded-xl text-gray-400 font-bold hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isCreating || (creationStep === 1 && loadingVersions)}
                                        className="bg-primary hover:bg-primary-hover text-black font-bold px-8 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                    >
                                        {isCreating && <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>}
                                        {isCreating ? 'Creating...' : (
                                            creationStep === 1 && selectedLoader.toLowerCase() !== 'vanilla' ? 'Next' : 'Create'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Import from Code Modal */}
            {showCodeModal && (
                <ModpackCodeModal
                    isOpen={showCodeModal}
                    mode="import"
                    instance={null} // Not needed for import
                    onClose={() => setShowCodeModal(false)}
                    onImportComplete={handleCodeImportComplete}
                />
            )}

            {showDeleteModal && (
                <ConfirmationModal
                    title="Delete Instance"
                    message={`Are you sure you want to delete "${instanceToDelete?.name}"? This action cannot be undone.`}
                    confirmText="Delete"
                    isDangerous={true}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => {
                        setShowDeleteModal(false);
                        setInstanceToDelete(null);
                    }}
                />
            )}
        </>
    );
}

export default Dashboard;
