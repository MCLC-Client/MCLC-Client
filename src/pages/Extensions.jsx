import React, { useState, useEffect } from 'react';
import { useExtensions } from '../context/ExtensionContext';

const Extensions = () => {
    const { installedExtensions, loadExtension, unloadExtension, toggleExtension } = useExtensions(); // Use Context
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [loading, setLoading] = useState(true);

    const handleUpload = async () => {
        if (!window.electronAPI) return;
        
        const file = await window.electronAPI.openFileDialog({
            filters: [{ name: 'MC Extension', extensions: ['mcextension', 'zip'] }]
        });
        
        if (file && !file.canceled && file.filePaths && file.filePaths.length > 0) {
            // Install from local path
            // alert("Installing from local file..."); // Removed alert for cleaner UX
            const result = await window.electronAPI.installExtension(file.filePaths[0]);
            if (result.success) {
                window.location.reload();
            } else {
                alert(`Failed to install: ${result.error}`);
            }
        }
    };

    const handleRemove = async (id) => {
        if (!window.electronAPI) return;
        // Unload first
        await unloadExtension(id);
        const result = await window.electronAPI.removeExtension(id);
        if (result.success) {
            window.location.reload(); 
        } else {
            alert(`Failed to remove: ${result.error}`);
        }
    };

    return (
        <div className="p-8 text-white h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">Extensions</h1>
                    <p className="text-gray-400 mt-1">Manage and configure your installed extensions.</p>
                </div>
                <button 
                    onClick={handleUpload}
                    className="bg-primary hover:scale-[1.02] text-black font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg flex items-center gap-2 shadow-primary/20 hover:shadow-primary/30"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload Extension
                </button>
            </div>
            
            <div className="flex flex-col gap-4">
                {installedExtensions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-surface/5 rounded-2xl border border-white/5 border-dashed">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <p className="text-gray-500 font-medium text-lg">No extensions installed</p>
                        <p className="text-gray-600 text-sm mt-1">Upload a .zip or .mcextension file to get started.</p>
                    </div>
                ) : (
                    installedExtensions.map(ext => (
                        <div key={ext.id} className={`p-5 rounded-2xl border flex items-center gap-5 transition-all group backdrop-blur-md ${ext.enabled ? 'bg-surface/20 border-white/10' : 'bg-surface/5 border-white/5 opacity-70'}`}>
                            {/* Icon / Placeholder */}
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold shadow-inner overflow-hidden flex-shrink-0 ${ext.enabled ? 'bg-primary/20 text-primary' : 'bg-gray-800 text-gray-500'}`}>
                                {ext.iconPath ? (
                                    <img 
                                        src={`app-media:///${ext.iconPath}`} 
                                        alt={ext.name} 
                                        className="w-full h-full object-cover"
                                        onError={(e) => { e.target.style.display = 'none'; }} 
                                    />
                                ) : (
                                    <span>{ext.name.charAt(0).toUpperCase()}</span>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3">
                                    <h3 className={`font-bold text-lg truncate ${ext.enabled ? 'text-white' : 'text-gray-400'}`}>{ext.name}</h3>
                                    <span className="text-xs bg-black/30 px-2 py-0.5 rounded text-gray-400 font-mono border border-white/5">{ext.version}</span>
                                </div>
                                <p className="text-sm text-gray-400 truncate">{ext.description || 'No description provided.'}</p>
                                <div className="mt-1 flex gap-4 text-xs text-gray-500">
                                    <span>By <span className="text-gray-300">{ext.author || 'Unknown'}</span></span>
                                    <span>ID: <span className="font-mono">{ext.id}</span></span>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                {/* Toggle Switch */}
                                <label className="flex items-center cursor-pointer relative">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={!!ext.enabled}
                                        onChange={(e) => toggleExtension(ext.id, e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    <span className="ml-3 text-sm font-medium text-gray-300 min-w-[60px]">{ext.enabled ? 'Enabled' : 'Disabled'}</span>
                                </label>

                                <div className="h-8 w-[1px] bg-white/10"></div>

                                <button 
                                    onClick={() => handleRemove(ext.id)}
                                    className="p-2 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                    title="Uninstall"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Extensions;
