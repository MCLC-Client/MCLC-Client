import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Dropdown from '../components/Dropdown';
import { useNotification } from '../context/NotificationContext';
import LoadingOverlay from '../components/LoadingOverlay';
import ConfirmationModal from '../components/ConfirmationModal';
import { Analytics } from '../services/Analytics';
import ModpackCodeModal from '../components/ModpackCodeModal';
import * as ReactWindow from 'react-window';
const { FixedSizeGrid } = ReactWindow;
import { AutoSizer } from 'react-virtualized-auto-sizer';
import OptimizedImage from '../components/OptimizedImage';
import { useTranslation } from 'react-i18next';

const DEFAULT_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'%3E%3C/path%3E%3Cpolyline points='3.27 6.96 12 12.01 20.73 6.96'%3E%3C/polyline%3E%3Cline x1='12' y1='22.08' x2='12' y2='12'%3E%3C/line%3E%3C/svg%3E";


const InstanceCard = ({
    instance,
    runningInstances,
    installProgress,
    pendingLaunches,
    onInstanceClick,
    handleContextMenu,
    addNotification,
    loadInstances,
    setPendingLaunches,
    t
}) => {
    const formatPlaytime = (ms) => {
        if (!ms || ms <= 0) return t('common.time.0h');
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        if (hours > 0) return t('common.time.hours_minutes', { hours, minutes });
        return t('common.time.minutes', { minutes });
    };

    const liveStatus = runningInstances[instance.name];
    const persistedStatus = instance.status;
    const installStateKey = Object.keys(installProgress).find(k => k.toLowerCase() === instance.name.toLowerCase());
    const installState = installStateKey ? installProgress[installStateKey] : null;
    const status = liveStatus || (installState || persistedStatus === 'installing' ? 'installing' : null);
    const isRunning = status === 'running';
    const isLaunching = status === 'launching';
    const isInstalling = status === 'installing';

    return (
        <div
            onClick={() => onInstanceClick(instance)}
            onContextMenu={(e) => handleContextMenu(e, instance)}
            className={`group bg-surface/40 backdrop-blur-sm border rounded-xl p-4 transition-all cursor-pointer relative overflow-hidden shadow-lg hover:shadow-xl hover:shadow-black/50 ${isRunning ? 'border-primary/50 ring-1 ring-primary/20' : 'border-white/5 hover:border-primary/50'}`}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-40 transition-opacity"></div>

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
                <OptimizedImage
                    src={instance.icon}
                    alt={instance.name}
                    className="w-16 h-16 bg-background rounded-lg flex items-center justify-center text-4xl shadow-inner border border-white/5 overflow-hidden"
                    fallback={<svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                />
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-white truncate group-hover:text-primary transition-colors">{instance.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span className="bg-white/5 px-2 py-0.5 rounded capitalize border border-white/5">{instance.loader || 'Vanilla'}</span>
                        <span>{instance.version}</span>
                    </div>
                    {status && status !== 'ready' && status !== 'stopped' && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-primary animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                            {isInstalling ? (installState ? `${t('common.installing')} (${installState.progress}%)` : t('common.installing')) : isLaunching ? t('common.starting') : t('common.running')}
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
                    title={isRunning ? t('common.stop') : isInstalling ? (installState ? installState.status : t('common.installing')) : isLaunching ? t('common.starting') : pendingLaunches[instance.name] ? t('common.starting') : t('dashboard.launch_game', 'Launch Game')}
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
};

function Dashboard({ onInstanceClick, runningInstances = {}, triggerCreate, onCreateHandled }) {
    const { addNotification } = useNotification();
    const { t } = useTranslation();
    const [instances, setInstances] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    useEffect(() => {
        if (triggerCreate) {
            setShowCreateModal(true);
            if (onCreateHandled) onCreateHandled();
        }
    }, [triggerCreate]);
    const [contextMenu, setContextMenu] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [instanceToDelete, setInstanceToDelete] = useState(null);
    const [newInstanceName, setNewInstanceName] = useState('');
    const [selectedVersion, setSelectedVersion] = useState('');
    const [selectedLoader, setSelectedLoader] = useState('Vanilla');
    const [newInstanceIcon, setNewInstanceIcon] = useState(DEFAULT_ICON);

    const [availableVersions, setAvailableVersions] = useState([]);
    const [loadingVersions, setLoadingVersions] = useState(false);

    const [isCreating, setIsCreating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [creationStep, setCreationStep] = useState(1);
    const [loaderVersions, setLoaderVersions] = useState([]);
    const [selectedLoaderVersion, setSelectedLoaderVersion] = useState('');
    const [availableLoaders, setAvailableLoaders] = useState({ Vanilla: true, Fabric: true, Forge: true, NeoForge: true, Quilt: true });
    const [checkingLoaders, setCheckingLoaders] = useState(false);
    const [pendingLaunches, setPendingLaunches] = useState({});
    const [installProgress, setInstallProgress] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearchQuery = React.useDeferredValue(searchQuery);
    const [sortMethod, setSortMethod] = useState('playtime');
    const [groupMethod, setGroupMethod] = useState('version');

    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const [showModalImportMenu, setShowModalImportMenu] = useState(false);
    const [showCodeModal, setShowCodeModal] = useState(false);
    const createMenuRef = useRef(null);
    const internalImportMenuRef = useRef(null);
    const fileInputRef = useRef(null);
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
        addNotification(t('dashboard.import_starting', { name: modpackData.name }), 'info');

        try {

            const createRes = await window.electronAPI.createInstance(
                modpackData.name,
                modpackData.instanceVersion || modpackData.version,
                modpackData.instanceLoader || modpackData.loader,
                null
            );

            if (createRes.success) {
                const instanceName = createRes.instanceName;
                setInstallProgress(prev => ({
                    ...prev,
                    [instanceName]: { progress: 0, status: 'Starting import...' }
                }));
                window.electronAPI.installSharedContent(instanceName, modpackData);

                addNotification(t('dashboard.instance_created', { name: instanceName }), 'success');
                loadInstances();
            } else {
                addNotification(t('dashboard.create_failed', { error: createRes.error }), 'error');
            }
        } catch (error) {
            console.error('Code import error:', error);
            addNotification(t('dashboard.import_failed', { error: error.message }), 'error');
        }
    };

    useEffect(() => {
        loadInstances();

        const testBackend = async () => {
            try {
                const pong = await window.electronAPI.ping();
                console.log('📡 [Dashboard] Backend Ping Result:', pong);
            } catch (err) {
                console.warn('📡 [Dashboard] Backend Ping Failed:', err.message);
            }
        };
        testBackend();
        const removeInstallListener = window.electronAPI.onInstallProgress((data) => {
            setInstallProgress(prev => {
                if (data.progress >= 100) {
                    const next = { ...prev };
                    delete next[data.instanceName];
                    return next;
                }
                return { ...prev, [data.instanceName]: data };
            });

            if (data.progress >= 100) {
                loadInstances();
            }
        });
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
    const [showSnapshots, setShowSnapshots] = useState(false);

    useEffect(() => {
        if (!showCreateModal) return;

        const updateVersions = async () => {
            setLoadingVersions(true);
            try {
                if (selectedLoader === 'Vanilla') {
                    const res = await window.electronAPI.getVanillaVersions();
                    if (res.success) {

                        const versions = res.versions.filter(v => showSnapshots ? true : v.type === 'release');
                        setAvailableVersions(versions);

                        if (versions.length > 0 && (!selectedVersion || !versions.find(v => v.id === selectedVersion))) {
                            setSelectedVersion(versions[0].id);
                        }
                    }
                } else {

                    const res = await window.electronAPI.getSupportedGameVersions(selectedLoader);
                    if (res.success) {
                        let versions = res.versions;
                        if (!showSnapshots) {
                            versions = versions.filter(v => /^\d+\.\d+(\.\d+)?$/.test(v));
                        }
                        const versionObjs = versions.map(v => ({ id: v, type: 'release' }));
                        setAvailableVersions(versionObjs);

                        if (versionObjs.length > 0 && (!selectedVersion || !versionObjs.find(v => v.id === selectedVersion))) {
                            setSelectedVersion(versionObjs[0].id);
                        } else if (versionObjs.length === 0) {
                            setSelectedVersion('');
                        }
                    } else {
                        setAvailableVersions([]);
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
        console.log('[Dashboard] Fetching instances...');
        const list = await window.electronAPI.getInstances();
        console.log('[Dashboard] Received instances:', list);
        setInstances(list || []);
    };

    const fetchVersions = async () => {
        setLoadingVersions(true);
        const res = await window.electronAPI.getVanillaVersions();
        setLoadingVersions(false);
        if (res.success) {

            const versions = res.versions.filter(v => v.type === 'release');
            setAvailableVersions(versions);
            if (versions.length > 0) setSelectedVersion(versions[0].id);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (isCreating) return;

        const loaderForApi = selectedLoader.toLowerCase();
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

                    setSelectedLoaderVersion(res.versions[0].version);
                    setCreationStep(2);
                    return;
                } else {
                    addNotification('No specific loader versions found, using latest.', 'info');

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

                setShowCreateModal(false);
                await loadInstances();
                addNotification(`Started creating: ${result.instanceName || nameToUse}`, 'success');
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
    const handleContextMenu = (e, instance) => {
        e.preventDefault();
        e.stopPropagation();
        const menuWidth = 180;
        const menuHeight = 280;
        let x = e.clientX;
        let y = e.clientY;
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
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);
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
        { value: 'name', label: t('dashboard.sort.name') },
        { value: 'version', label: t('dashboard.sort.version') },
        { value: 'playtime', label: t('dashboard.sort.playtime') }
    ];

    const groupOptions = [
        { value: 'none', label: t('dashboard.group.none') },
        { value: 'version', label: t('dashboard.group.version') },
        { value: 'loader', label: t('dashboard.group.loader') }
    ];
    const filteredInstances = instances.filter(inst =>
        inst.name.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
        inst.version.toLowerCase().includes(deferredSearchQuery.toLowerCase())
    );
    const sortedInstances = [...filteredInstances].sort((a, b) => {
        if (sortMethod === 'name') return a.name.localeCompare(b.name);
        if (sortMethod === 'playtime') return (b.playtime || 0) - (a.playtime || 0);
        if (sortMethod === 'version') {

            return b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' });
        }
        return 0;
    });
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
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            if (groupMethod === 'version') return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
            return a.localeCompare(b);
        });

        sortedKeys.forEach(key => {
            groupedData.push({ title: key, items: groups[key] });
        });
    }

    return (
        <div className="w-full h-full flex flex-col overflow-hidden relative">
            <div className="p-8 flex-1 min-h-0 flex flex-col w-full h-full">
                {isLoading && <LoadingOverlay message="Processing..." />}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">{t('dashboard.title')}</h1>
                        <p className="text-gray-400 text-sm">{t('dashboard.desc')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="text"
                                placeholder={t('dashboard.search_placeholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 bg-background border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                            />
                        </div>
                        <div className="w-48">
                            <Dropdown options={sortOptions} value={sortMethod} onChange={setSortMethod} />
                        </div>
                        <div className="w-48">
                            <Dropdown options={groupOptions} value={groupMethod} onChange={setGroupMethod} />
                        </div>

                        { }
                        <div className="relative" ref={createMenuRef}>
                            <button
                                onClick={() => setShowCreateMenu(!showCreateMenu)}
                                className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-black transition-all transform rounded-xl shadow-primary-glow bg-primary hover:bg-primary-hover hover:scale-105"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                {t('dashboard.new_instance')}
                                <svg className={`w-4 h-4 transition-transform ${showCreateMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {showCreateMenu && (
                                <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-surface py-2 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-100">
                                    <button
                                        onClick={() => {
                                            setShowCreateModal(true);
                                            setShowCreateMenu(false);
                                        }}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-white/5"
                                    >
                                        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        {t('dashboard.manual_creation')}
                                    </button>
                                    <div className="my-1 h-px bg-white/5"></div>
                                    <button
                                        onClick={async () => {
                                            setShowCreateMenu(false);
                                            console.log('[Dashboard] 📁 Unified Import triggered (Header)');
                                            try {
                                                if (!window.electronAPI.importFile) {
                                                    throw new Error('electronAPI.importFile is not defined. Please restart the application.');
                                                }
                                                const result = await window.electronAPI.importFile();
                                                console.log('[Dashboard] 📁 Unified Import result:', result);
                                                if (result.success) {
                                                    addNotification(`Importing Modpack: ${result.instanceName}...`, 'info');
                                                    loadInstances();
                                                } else if (result.error !== 'Cancelled') {
                                                    addNotification(`Import failed: ${result.error}`, 'error');
                                                }
                                            } catch (err) {
                                                console.error('[Dashboard] 📁 Unified Import error:', err);
                                                addNotification(`Import error: ${err.message}`, 'error');
                                            }
                                        }}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-white/5"
                                    >
                                        <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        {t('dashboard.import_file')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowCreateMenu(false);
                                            setShowCodeModal(true);
                                        }}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-white/5"
                                    >
                                        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                        {t('dashboard.import_code')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="relative flex h-full w-full flex-col overflow-hidden pr-1">
                    { }
                    <div className="flex h-full min-h-0 flex-col overflow-hidden pr-1">
                        {groupMethod !== 'none' ? (
                            <div className="custom-scrollbar h-full overflow-y-auto pb-20">
                                {groupedData.map((group, gIdx) => (
                                    <div key={group.title || 'all'} className={gIdx > 0 ? 'mt-3' : ''}>
                                        {group.title && (
                                            <div className="mb-4 flex items-center gap-4">
                                                <span className="whitespace-nowrap text-sm font-bold text-white opacity-80">{group.title}</span>
                                                <div className="flex-1 h-px bg-white/10"></div>
                                            </div>
                                        )}
                                        <div className="mb-8 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
                                            {group.items.map((instance) => (
                                                <InstanceCard
                                                    key={instance.name}
                                                    instance={instance}
                                                    runningInstances={runningInstances}
                                                    installProgress={installProgress}
                                                    pendingLaunches={pendingLaunches}
                                                    onInstanceClick={onInstanceClick}
                                                    handleContextMenu={handleContextMenu}
                                                    addNotification={addNotification}
                                                    loadInstances={loadInstances}
                                                    setPendingLaunches={setPendingLaunches}
                                                    t={t}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="custom-scrollbar h-full overflow-y-auto pb-20">
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 p-1">
                                    {sortedInstances.map((instance) => (
                                        <InstanceCard
                                            key={instance.name}
                                            instance={instance}
                                            runningInstances={runningInstances}
                                            installProgress={installProgress}
                                            pendingLaunches={pendingLaunches}
                                            onInstanceClick={onInstanceClick}
                                            handleContextMenu={handleContextMenu}
                                            addNotification={addNotification}
                                            loadInstances={loadInstances}
                                            setPendingLaunches={setPendingLaunches}
                                            t={t}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {groupedData.length === 0 || (groupedData.length === 1 && groupedData[0].items.length === 0) ? (
                    <div className="col-span-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/5 py-20 text-center text-gray-500">
                        <svg className="mb-4 h-12 w-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        <p className="mb-2 text-xl font-medium text-gray-400">{t('dashboard.no_instances')}</p>
                        <p className="text-sm">{t('dashboard.create_to_start')}</p>
                    </div>
                ) : null}
            </div>

            {contextMenu && createPortal(
                <div
                    className="fixed z-[9999] min-w-[180px] rounded-lg border border-white/10 bg-surface py-2 shadow-2xl"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={() => handleContextAction('play')} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-white/5">
                        <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                        {t('dashboard.context.play')}
                    </button>
                    <div className="my-1 border-t border-white/5"></div>
                    <button onClick={() => handleContextAction('view')} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-white/5">
                        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        {t('dashboard.context.view')}
                    </button>
                    <button onClick={() => handleContextAction('duplicate')} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-white/5">
                        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        {t('dashboard.context.duplicate')}
                    </button>
                    <button onClick={() => handleContextAction('export')} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-white/5">
                        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        {t('dashboard.context.export')}
                    </button>
                    <button onClick={() => handleContextAction('folder')} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-white/5">
                        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                        {t('dashboard.context.folder')}
                    </button>
                    <div className="my-1 border-t border-white/5"></div>
                    <button onClick={() => handleContextAction('delete')} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/20">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        {t('dashboard.context.delete')}
                    </button>
                </div>,
                document.body
            )}

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/80">
                    <div className="w-full max-w-lg transform rounded-2xl border border-white/10 bg-surface p-8 shadow-2xl transition-all scale-100">
                        <h2 className="mb-6 text-center text-2xl font-bold text-white">Create New Instance</h2>
                        <form onSubmit={handleCreate} className="space-y-6">
                            {creationStep === 1 && (
                                <>
                                    { }
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="group relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-white/10 bg-background transition-colors hover:border-primary/50"
                                            onClick={() => fileInputRef.current?.click()}>
                                            <img src={newInstanceIcon} alt="Icon" className="object-cover w-full h-full" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
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
                                        <span className="text-xs font-bold tracking-wide text-gray-400 uppercase">Click to upload icon</span>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-bold tracking-wide text-gray-400 uppercase">Name</label>
                                        <input
                                            type="text"
                                            value={newInstanceName}
                                            onChange={(e) => setNewInstanceName(e.target.value)}
                                            className="w-full rounded-xl border border-white/10 bg-background p-3 text-white outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                                            placeholder="New Instance"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="mb-2 flex items-center justify-between">
                                                <label className="mb-2 block text-sm font-bold tracking-wide text-gray-400 uppercase">{t('dashboard.version')}</label>
                                                <div className="flex cursor-pointer items-center gap-2" onClick={() => setShowSnapshots(!showSnapshots)}>
                                                    <div className={`relative h-4 w-8 rounded-full transition-colors ${showSnapshots ? 'bg-primary' : 'bg-gray-600'}`}>
                                                        <div className={`absolute top-0.5 bottom-0.5 h-3 w-3 rounded-full bg-white transition-all ${showSnapshots ? 'left-4.5' : 'left-0.5'}`} style={{ left: showSnapshots ? '18px' : '2px' }}></div>
                                                    </div>
                                                    <span className="text-[10px] font-bold uppercase text-gray-400">{t('dashboard.dev_builds')}</span>
                                                </div>
                                            </div>
                                            {loadingVersions ? (
                                                <div className="rounded-xl border border-white/10 bg-background p-3 text-gray-500">{t('common.loading')}</div>
                                            ) : (
                                                <Dropdown
                                                    options={versionOptions}
                                                    value={selectedVersion}
                                                    onChange={setSelectedVersion}
                                                    placeholder={t('dashboard.select_version')}
                                                />
                                            )}
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-bold tracking-wide text-gray-400 uppercase">{t('dashboard.loader')}</label>
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
                                    <label className="mb-2 block text-sm font-bold tracking-wide text-gray-400 uppercase">{t('dashboard.select_loader_version', { loader: selectedLoader })}</label>
                                    <Dropdown
                                        options={loaderVersions.map(v => ({ value: v.version, label: v.version }))}
                                        value={selectedLoaderVersion}
                                        onChange={setSelectedLoaderVersion}
                                        placeholder={t('dashboard.select_loader_version_placeholder')}
                                    />
                                    <p className="mt-2 text-xs text-gray-500">Minecraft {selectedVersion}</p>
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
                                            {t('dashboard.import_options')}
                                            <svg className={`w-3 h-3 transition-transform ${showModalImportMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>

                                        {showModalImportMenu && (
                                            <div className="absolute left-0 bottom-full mb-2 w-56 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl z-[60] overflow-hidden py-2 animate-in fade-in slide-in-from-bottom-2 duration-100">
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        setShowModalImportMenu(false);
                                                        console.log('[Dashboard] 📁 Unified Import triggered (Modal)');
                                                        try {
                                                            if (!window.electronAPI.importFile) {
                                                                throw new Error('electronAPI.importFile is not defined. Please restart the application.');
                                                            }
                                                            const result = await window.electronAPI.importFile();
                                                            console.log('[Dashboard] 📁 Unified Import result:', result);
                                                            if (result.success) {
                                                                addNotification(`Importing Modpack: ${result.instanceName}...`, 'info');
                                                                setShowCreateModal(false);
                                                                loadInstances();
                                                            } else if (result.error !== 'Cancelled') {
                                                                addNotification(`Import failed: ${result.error}`, 'error');
                                                            }
                                                        } catch (err) {
                                                            console.error('[Dashboard] 📁 Unified Import error:', err);
                                                            addNotification(`Import error: ${err.message}`, 'error');
                                                        }
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 transition-colors text-xs text-gray-200"
                                                >
                                                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                    {t('dashboard.import_file')}
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
                                                    {t('dashboard.import_code')}
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
                                        {t('common.back')}
                                    </button>
                                )}

                                <div className="flex gap-3 ml-auto">
                                    <button
                                        type="button"
                                        disabled={isCreating}
                                        onClick={() => setShowCreateModal(false)}
                                        className="px-6 py-2 rounded-xl text-gray-400 font-bold hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isCreating || (creationStep === 1 && loadingVersions)}
                                        className="bg-primary hover:bg-primary-hover text-black font-bold px-8 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                    >
                                        {isCreating && <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>}
                                        {isCreating ? t('common.creating') : (
                                            creationStep === 1 && selectedLoader.toLowerCase() !== 'vanilla' ? t('common.next') : t('common.create')
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            { }
            {showCodeModal && (
                <ModpackCodeModal
                    isOpen={showCodeModal}
                    mode="import"
                    instance={null}
                    onClose={() => setShowCodeModal(false)}
                    onImportComplete={handleCodeImportComplete}
                />
            )}

            {showDeleteModal && (
                <ConfirmationModal
                    title={t('dashboard.delete_title')}
                    message={t('dashboard.delete_message', { name: instanceToDelete?.name })}
                    confirmText={t('common.delete')}
                    isDangerous={true}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => {
                        setShowDeleteModal(false);
                        setInstanceToDelete(null);
                    }}
                />
            )}
        </div>
    );
}

export default Dashboard;