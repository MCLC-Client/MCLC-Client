import React, { useState, useEffect } from 'react';
import ExtensionLoader from '../components/Extensions/ExtensionLoader';

const Extensions = () => {
    const [extensions, setExtensions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [installedExtensions, setInstalledExtensions] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [marketplaceExtensions, setMarketplaceExtensions] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (window.electronAPI) {
                    const installedRes = await window.electronAPI.getExtensions();
                    if (installedRes.success) {
                        setInstalledExtensions(installedRes.extensions);
                    }
                    
                    const marketRes = await window.electronAPI.fetchMarketplace();
                    if (marketRes.success) {
                        setMarketplaceExtensions(marketRes.extensions);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch extensions", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [refreshTrigger]);

    const handleMarketplaceInstall = async (url) => {
        if (!url) {
            alert("This extension does not have a download URL.");
            return;
        }
        
        // Optimistic UI or loading state could be added here
        alert("Downloading extension...");
        try {
            const result = await window.electronAPI.installExtension(url);
            if (result.success) {
                setRefreshTrigger(prev => prev + 1);
                alert(`Successfully installed extension: ${result.id}`);
            } else {
                alert(`Failed to install: ${result.error}`);
            }
        } catch (error) {
            alert(`Error during installation: ${error.message}`);
        }
    };

    const handleUpload = async () => {
        if (!window.electronAPI) return;
        
        const file = await window.electronAPI.openFileDialog({
            filters: [{ name: 'MC Extension', extensions: ['mcextension', 'zip'] }]
        });
        
        if (file && !file.canceled && file.filePaths && file.filePaths.length > 0) {
            // Install from local path
            alert("Installing from local file...");
            const result = await window.electronAPI.installExtension(file.filePaths[0]);
            if (result.success) {
                setRefreshTrigger(prev => prev + 1);
                alert(`Successfully installed: ${result.id}`);
            } else {
                alert(`Failed to install: ${result.error}`);
            }
        }
    };

    const handleRemove = async (id) => {
        if (!window.electronAPI) return;
        const result = await window.electronAPI.removeExtension(id);
        if (result.success) {
            setRefreshTrigger(prev => prev + 1);
        } else {
            alert(`Failed to remove: ${result.error}`);
        }
    };

    return (
        <div className="p-6 text-white h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Extensions</h1>
                <button 
                    onClick={handleUpload}
                    className="bg-[#22e07a] hover:bg-[#1bd96a] text-black font-semibold px-4 py-2 rounded-lg transition shadow-lg flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload Extension
                </button>
            </div>
            
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 text-gray-300">Installed</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {installedExtensions.length === 0 ? (
                        <p className="text-gray-500 col-span-full italic">No extensions installed.</p>
                    ) : (
                        installedExtensions.map(ext => (
                            <div key={ext.id} className="bg-[#1c1c1c] p-4 rounded-lg border border-gray-800 flex flex-col gap-2 shadow-sm hover:border-gray-600 transition">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-lg">{ext.name}</h3>
                                    <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300 font-mono">{ext.version}</span>
                                </div>
                                <p className="text-sm text-gray-400 line-clamp-2">{ext.description}</p>
                                <div className="mt-auto pt-4 flex gap-2">
                                     <button 
                                        onClick={() => handleRemove(ext.id)}
                                        className="bg-red-500/10 text-red-500 hover:bg-red-500/20 px-3 py-1 rounded text-sm transition font-medium border border-red-500/20"
                                    >
                                        Remove
                                    </button>
                                </div>
                                <div className="mt-4 border-t border-gray-700 pt-4 bg-black/20 -mx-4 -mb-4 px-4 pb-4">
                                    <h4 className="text-xs uppercase text-gray-500 mb-2 font-bold tracking-wider">Preview</h4>
                                    <ExtensionLoader extensionPath={ext.localPath + '/' + (ext.main || 'index.js')} api={window.electronAPI} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div>
                <h2 className="text-xl font-semibold mb-4 text-gray-300">Marketplace (Mock)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {marketplaceExtensions.map(ext => {
                        const isInstalled = installedExtensions.some(e => e.id === ext.id);
                        return (
                            <div key={ext.id} className="bg-[#1c1c1c] p-4 rounded-lg border border-gray-800 flex flex-col gap-2 opacity-90 hover:opacity-100 hover:border-gray-600 transition">
                                <h3 className="font-bold text-lg">{ext.name}</h3>
                                <p className="text-sm text-gray-400">{ext.description}</p>
                                <p className="text-xs text-gray-500">By {ext.author}</p>
                                <button 
                                    onClick={() => handleMarketplaceInstall(ext.url)}
                                    disabled={isInstalled}
                                    className={`mt-4 px-4 py-2 rounded text-sm font-bold transition flex items-center justify-center gap-2 ${
                                        isInstalled 
                                            ? 'bg-green-500/20 text-green-500 cursor-default border border-green-500/20' 
                                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                    }`}
                                >
                                    {isInstalled ? (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                            Installed
                                        </>
                                    ) : 'Install'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default Extensions;
