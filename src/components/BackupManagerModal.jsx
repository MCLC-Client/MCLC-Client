import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import {
    CloudArrowUpIcon,
    CloudArrowDownIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    ArrowLeftIcon,
    FolderIcon,
    ArchiveBoxIcon,
    CheckIcon,
    ArrowUpTrayIcon,
    ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import {
    CheckCircleIcon as CheckCircleIconSolid
} from '@heroicons/react/24/solid';

const BackupManagerModal = ({ instance, onClose, worlds, onBackupStatusChange }) => {
    const [view, setView] = useState('mode-select'); // 'mode-select' | 'setup'
    const [mode, setMode] = useState('backup'); // 'backup' | 'import'
    const [type, setType] = useState('local'); // 'local' | 'cloud'
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [localBackups, setLocalBackups] = useState([]);
    const [cloudBackups, setCloudBackups] = useState([]);
    const { addNotification } = useNotification();

    useEffect(() => {
        if (view === 'setup') {
            if (mode === 'import') {
                if (type === 'local') loadLocalBackups();
                else loadCloudBackups();
            }
        }
    }, [view, type, mode]);

    const loadLocalBackups = async () => {
        setLoading(true);
        try {
            const res = await window.electronAPI.listLocalBackups(instance.name);
            if (res.success) setLocalBackups(res.backups);
            else addNotification('Failed to load local backups: ' + res.error, 'error');
        } catch (e) {
            addNotification('Error loading local backups', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadCloudBackups = async () => {
        setLoading(true);
        try {
            const settings = await window.electronAPI.getSettings();
            const provider = settings.settings.cloudBackupSettings?.provider || 'GOOGLE_DRIVE';
            const res = await window.electronAPI.cloudListBackups(provider, instance.name);
            if (res.success) setCloudBackups(res.files);
            else addNotification('Failed to load cloud backups: ' + res.error, 'error');
        } catch (e) {
            addNotification('Error loading cloud backups', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async () => {
        setLoading(true);
        let successCount = 0;
        try {
            if (mode === 'backup') {
                for (const worldFolder of selectedItems) {
                    const res = await window.electronAPI.backupWorld(instance.name, worldFolder, type === 'cloud');
                    if (res.success) {
                        successCount++;
                    }
                }
                addNotification(`Successfully backed up ${successCount} world(s)`, 'success');
            } else {
                // Import
                const settings = await window.electronAPI.getSettings();
                const provider = settings.settings.cloudBackupSettings?.provider || 'GOOGLE_DRIVE';

                for (const itemId of selectedItems) {
                    let res;
                    if (type === 'local') {
                        res = await window.electronAPI.restoreLocalBackup(instance.name, itemId);
                    } else {
                        // Cloud import
                        const backupItem = cloudBackups.find(b => b.id === itemId);
                        if (!backupItem) continue;

                        addNotification(`Downloading ${backupItem.name}...`, 'info');
                        const backupsDir = await window.electronAPI.getBackupsDir(instance.name);
                        const fileName = `cloud_temp_${backupItem.name}`;
                        const tempPath = `${backupsDir}/${fileName}`;

                        const downloadRes = await window.electronAPI.cloudDownload(provider, backupItem.id, tempPath);
                        if (downloadRes.success) {
                            addNotification(`Restoring ${backupItem.name}...`, 'info');
                            res = await window.electronAPI.restoreLocalBackup(instance.name, fileName);
                            // Cleanup temp file after restore
                            await window.electronAPI.removeFile(tempPath);
                        } else {
                            addNotification(`Download failed: ${downloadRes.error}`, 'error');
                        }
                    }
                    if (res?.success) successCount++;
                }
                if (successCount > 0) addNotification(`Successfully restored ${successCount} backup(s)`, 'success');
            }
            onClose();
        } catch (e) {
            addNotification(`Action failed: ${e.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const toggleItem = (id) => {
        setSelectedItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const renderItem = (item, isSelectable) => {
        const id = mode === 'backup' ? item.folderName : (type === 'local' ? item.name : item.id);
        const name = mode === 'backup' ? item.name : item.name;
        const sub = mode === 'backup' ? item.folderName : (item.date ? new Date(item.date).toLocaleString() : '');
        const isSelected = selectedItems.includes(id);

        return (
            <div
                key={id}
                onClick={() => toggleItem(id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${isSelected ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
            >
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? 'bg-primary text-black' : 'bg-white/5 text-gray-400'}`}>
                        {mode === 'backup' ? <FolderIcon className="h-6 w-6" /> : <ArchiveBoxIcon className="h-6 w-6" />}
                    </div>
                    <div>
                        <h4 className="font-bold text-white group-hover:text-primary transition-colors">{name}</h4>
                        <p className="text-[10px] uppercase font-black tracking-widest text-gray-400">{sub}</p>
                    </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-white/20 group-hover:border-white/40'}`}>
                    {isSelected && <CheckIcon className="h-4 w-4 text-black stroke-[3]" />}
                </div>
            </div>
        );
    };

    const getFilteredList = () => {
        let list = mode === 'backup' ? worlds : (type === 'local' ? localBackups : cloudBackups);
        return list.filter(i => (i.name || i.folderName || '').toLowerCase().includes(searchQuery.toLowerCase()));
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-white">Backup Manager</h3>
                        <p className="text-sm text-gray-400">Manage your instance backups and world storage</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                        <XMarkIcon className="h-6 w-6 text-gray-400" />
                    </button>
                </div>

                {view === 'mode-select' ? (
                    <div className="grid grid-cols-2 gap-4 py-8">
                        <button
                            onClick={() => { setMode('backup'); setView('setup'); }}
                            className="bg-white/5 border border-white/10 p-8 rounded-2xl flex flex-col items-center gap-4 hover:bg-primary/5 hover:border-primary/50 transition-all group"
                        >
                            <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                                <ArrowUpTrayIcon className="h-10 w-10" />
                            </div>
                            <span className="font-bold text-lg text-white">Create Backup</span>
                            <span className="text-xs text-center text-gray-500">Backup your worlds to local storage or the cloud</span>
                        </button>
                        <button
                            onClick={() => { setMode('import'); setView('setup'); }}
                            className="bg-white/5 border border-white/10 p-8 rounded-2xl flex flex-col items-center gap-4 hover:bg-primary/5 hover:border-primary/50 transition-all group"
                        >
                            <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                                <ArrowDownTrayIcon className="h-10 w-10" />
                            </div>
                            <span className="font-bold text-lg text-white">Import Backup</span>
                            <span className="text-xs text-center text-gray-500">Restore worlds from local files or cloud backups</span>
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex bg-background-dark/50 p-1 rounded-xl border border-white/5 mb-6">
                            <button
                                onClick={() => { setType('local'); setSelectedItems([]); }}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${type === 'local' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                Local Storage
                            </button>
                            <button
                                onClick={() => { setType('cloud'); setSelectedItems([]); }}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${type === 'cloud' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                Cloud Storage
                            </button>
                        </div>

                        <div className="relative mb-4">
                            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-2.5 text-gray-500" />
                            <input
                                type="text"
                                placeholder={`Search for ${mode === 'backup' ? 'worlds' : 'backups'}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm text-gray-300 focus:border-primary outline-none transition-all"
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-2 mb-6 custom-scrollbar min-h-[300px]">
                            {loading ? (
                                <div className="flex justify-center py-20">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                                </div>
                            ) : getFilteredList().length === 0 ? (
                                <div className="text-center py-20 text-gray-500 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                                    No {mode === 'backup' ? 'worlds' : 'backups'} found.
                                </div>
                            ) : (
                                getFilteredList().map(item => renderItem(item))
                            )}
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-white/5">
                            <button
                                onClick={() => setView('mode-select')}
                                className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all flex items-center gap-2"
                            >
                                <ArrowLeftIcon className="h-4 w-4" />
                                Back
                            </button>
                            <button
                                onClick={handleAction}
                                disabled={selectedItems.length === 0 || loading}
                                className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg ${selectedItems.length === 0 || loading ? 'bg-white/10 text-gray-500 cursor-not-allowed' : 'bg-primary text-black hover:scale-[1.02] active:scale-95 shadow-primary/20'}`}
                            >
                                {loading ? 'Processing...' : `${mode === 'backup' ? 'Create' : 'Restore'} ${selectedItems.length} Item(s)`}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BackupManagerModal;
