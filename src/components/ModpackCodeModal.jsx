import React, { useState } from 'react';
import { useNotification } from '../context/NotificationContext';

function ModpackCodeModal({
    isOpen,
    onClose,
    mode,
    instanceData = null,
    mods = [],
    resourcePacks = [],
    shaders = [],
    onImportComplete
}) {
    const [code, setCode] = useState('');
    const [modpackName, setModpackName] = useState('');
    const [loading, setLoading] = useState(false);
    const [exportedCode, setExportedCode] = useState('');
    const [selectedTypes, setSelectedTypes] = useState({
        mods: true,
        resourcePacks: true,
        shaders: true
    });

    const { addNotification } = useNotification();
    const handleExport = async () => {
        console.log('[ModpackCodeModal] handleExport gestartet');

        if (!mods.length && !resourcePacks.length && !shaders.length) {
            addNotification('No content to export!', 'error');
            return;
        }

        setLoading(true);
        try {
            const exportData = {
                name: modpackName || `${instanceData?.name || 'Modpack'} Export`,
                instanceName: instanceData?.name,
                mods: selectedTypes.mods ? mods : [],
                resourcePacks: selectedTypes.resourcePacks ? resourcePacks : [],
                shaders: selectedTypes.shaders ? shaders : [],
                instanceVersion: instanceData?.version,
                instanceLoader: instanceData?.loader
            };

            console.log('[ModpackCodeModal] Export data:', exportData);
            console.log('[ModpackCodeModal] window.electronAPI existiert:', !!window.electronAPI);
            console.log('[ModpackCodeModal] exportModpackAsCode existiert:', !!window.electronAPI?.exportModpackAsCode);

            if (!window.electronAPI?.exportModpackAsCode) {
                throw new Error('exportModpackAsCode is not available in electronAPI');
            }

            const result = await window.electronAPI.exportModpackAsCode(exportData);
            console.log('[ModpackCodeModal] Export result:', result);

            if (result.success) {
                setExportedCode(result.code);
                addNotification(`Successfully exported! Code: ${result.code}`, 'success');
            } else {
                addNotification(`Export failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('[ModpackCodeModal] Export error:', error);
            addNotification(`Export error: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        if (!code || code.length !== 8) {
            addNotification('Please enter a valid 8-character code', 'error');
            return;
        }

        setLoading(true);
        try {
            const result = await window.electronAPI.importModpackFromCode(code);

            if (result.success) {
                addNotification(`Successfully loaded modpack: ${result.data.name}`, 'success');
                onImportComplete(result.data);
                onClose();
            } else {
                addNotification(`Import failed: ${result.error}`, 'error');
            }
        } catch (error) {
            addNotification(`Import error: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#151515] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl animate-scale-in">
                { }
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">
                        {mode === 'export' ? 'Export as Code' : 'Import from Code'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                { }
                <div className="p-6">
                    {mode === 'export' ? (
                        <>
                            {exportedCode ? (
                                <div className="text-center">
                                    <div className="mb-4">
                                        <div className="text-sm text-gray-400 mb-2">Your export code:</div>
                                        <div className="text-4xl font-mono font-bold bg-primary/20 text-primary p-4 rounded-xl border border-primary/30">
                                            {exportedCode}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(exportedCode);
                                            addNotification('Code copied to clipboard!', 'success');
                                        }}
                                        className="mt-4 px-6 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white font-bold transition-colors"
                                    >
                                        Copy Code
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-4">
                                        <label className="block text-sm font-bold text-gray-400 mb-2">
                                            Modpack Name (optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={modpackName}
                                            onChange={(e) => setModpackName(e.target.value)}
                                            placeholder="My Awesome Modpack"
                                            className="w-full bg-background-dark border border-white/10 rounded-lg p-3 text-white focus:border-primary outline-none"
                                        />
                                    </div>

                                    <div className="mb-6">
                                        <label className="block text-sm font-bold text-gray-400 mb-2">
                                            Include in export:
                                        </label>
                                        <div className="space-y-2 bg-background-dark/50 p-3 rounded-lg border border-white/5">
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedTypes.mods ? 'bg-primary border-primary' : 'border-gray-600'}`}>
                                                    {selectedTypes.mods && (
                                                        <svg className="w-3.5 h-3.5 text-black" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTypes.mods}
                                                    onChange={() => setSelectedTypes(prev => ({ ...prev, mods: !prev.mods }))}
                                                    className="hidden"
                                                />
                                                <span className="flex-1 text-white">Mods ({mods.length})</span>
                                            </label>

                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedTypes.resourcePacks ? 'bg-primary border-primary' : 'border-gray-600'}`}>
                                                    {selectedTypes.resourcePacks && (
                                                        <svg className="w-3.5 h-3.5 text-black" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTypes.resourcePacks}
                                                    onChange={() => setSelectedTypes(prev => ({ ...prev, resourcePacks: !prev.resourcePacks }))}
                                                    className="hidden"
                                                />
                                                <span className="flex-1 text-white">Resource Packs ({resourcePacks.length})</span>
                                            </label>

                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedTypes.shaders ? 'bg-primary border-primary' : 'border-gray-600'}`}>
                                                    {selectedTypes.shaders && (
                                                        <svg className="w-3.5 h-3.5 text-black" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTypes.shaders}
                                                    onChange={() => setSelectedTypes(prev => ({ ...prev, shaders: !prev.shaders }))}
                                                    className="hidden"
                                                />
                                                <span className="flex-1 text-white">Shaders ({shaders.length})</span>
                                            </label>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleExport}
                                        disabled={loading || (!mods.length && !resourcePacks.length && !shaders.length) || (modpackName && !/^[a-zA-Z0-9-_\s]+$/.test(modpackName))}
                                        className="w-full py-3 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                                                Exporting...
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                                Generate Code
                                            </>
                                        )}
                                    </button>
                                    {modpackName && !/^[a-zA-Z0-9-_\s]+$/.test(modpackName) && (
                                        <p className="text-red-400 text-xs mt-2 text-center">
                                            Name contains invalid characters. Only letters, numbers, spaces, hyphens, and underscores are allowed.
                                        </p>
                                    )}
                                </>
                            )}
                        </>
                    ) : (

                        <>
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-400 mb-2">
                                    Enter 8-character code
                                </label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.slice(0, 8))}
                                    placeholder="e.g. aB3xY7zP"
                                    maxLength="8"
                                    className="w-full bg-background-dark border border-white/10 rounded-lg p-3 text-white font-mono text-center text-2xl tracking-widest focus:border-primary outline-none"
                                    autoFocus
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    Enter the 8-character code you received from the modpack creator
                                </p>
                            </div>

                            <button
                                onClick={handleImport}
                                disabled={loading || code.length !== 8}
                                className="w-full py-3 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                                        Loading Modpack...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        Import Modpack
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ModpackCodeModal;