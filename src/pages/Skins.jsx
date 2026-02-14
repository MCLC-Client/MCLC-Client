import React, { useEffect, useRef, useState } from 'react';
import { SkinViewer, WalkingAnimation, IdleAnimation } from 'skinview3d';
import { useNotification } from '../context/NotificationContext';

function Skins({ onLogout }) {
    const { addNotification } = useNotification();
    const canvasRef = useRef(null);
    const skinViewerRef = useRef(null);

    // State
    const [currentSkinUrl, setCurrentSkinUrl] = useState(null); // The one on the character
    const [originalSkinUrl, setOriginalSkinUrl] = useState(null); // The one from Mojang (for reference)
    const [localSkins, setLocalSkins] = useState([]);
    const [selectedLocalSkin, setSelectedLocalSkin] = useState(null); // The one selected in the grid
    const [variant, setVariant] = useState('classic'); // classic (Steve) or slim (Alex)
    const [isAnimating, setIsAnimating] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [editingSkinId, setEditingSkinId] = useState(null);
    const [editName, setEditName] = useState('');

    const [userProfile, setUserProfile] = useState(null);

    // Initialize Viewer
    useEffect(() => {
        if (!canvasRef.current) return;

        const viewer = new SkinViewer({
            canvas: canvasRef.current,
            width: 300,
            height: 400,
            skin: "https://textures.minecraft.net/texture/1a4af718455d4aab528e7a61f86fa25e6a369d1768dcb13f7df319a713eb810b" // Default Steve
        });

        // viewer.loadCape(null); // No cape by default
        viewer.fov = 70;
        viewer.zoom = 0.9;
        viewer.animation = new WalkingAnimation();
        viewer.autoRotate = true;
        viewer.autoRotateSpeed = 0.5;

        skinViewerRef.current = viewer;

        return () => {
            viewer.dispose();
        };
    }, []);

    // Load Data
    useEffect(() => {
        loadProfileAndSkin();
        loadLocalSkins();
    }, []);

    // Handle Resize
    useEffect(() => {
        const handleResize = () => {
            if (skinViewerRef.current && canvasRef.current) {
                // Keep dimensions fixed or responsive? Fixed for now
                // skinViewerRef.current.width ...
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Toggle Animation
    useEffect(() => {
        if (skinViewerRef.current) {
            skinViewerRef.current.animation = isAnimating ? new WalkingAnimation() : new IdleAnimation();
        }
    }, [isAnimating]);

    const loadProfileAndSkin = async () => {
        setIsLoading(true);
        try {
            if (!window.electronAPI?.getProfile) return;

            // 1. Validate Session first
            if (window.electronAPI.validateSession) {
                const val = await window.electronAPI.validateSession();
                if (!val.success) {
                    // No notification as requested, just trigger logout
                    if (onLogout) {
                        onLogout();
                    } else {
                        // Fallback: clear local state and potentially reload or just show guest
                        setUserProfile(null);
                    }
                    setIsLoading(false);
                    return;
                }
            }

            const profile = await window.electronAPI.getProfile();
            setUserProfile(profile);

            if (profile && profile.access_token && window.electronAPI.getCurrentSkin) {
                try {
                    const res = await window.electronAPI.getCurrentSkin(profile.access_token);
                    if (res.success) {
                        setOriginalSkinUrl(res.url);
                        setCurrentSkinUrl(res.url);
                        setVariant(res.variant || 'classic');

                        if (skinViewerRef.current) {
                            skinViewerRef.current.loadSkin(res.url, { model: res.variant.toLowerCase() || 'classic' });
                        }
                    }
                } catch (e) {
                    console.error("Failed to load skin", e);
                }
            }
        } catch (e) {
            console.error("Failed to load profile/skin", e);
        }
        setIsLoading(false);
    };

    const loadLocalSkins = async () => {
        try {
            if (!window.electronAPI?.getLocalSkins) {
                console.warn("getLocalSkins API not available");
                return;
            }
            const skins = await window.electronAPI.getLocalSkins();
            setLocalSkins(skins || []);
        } catch (e) {
            console.error("Failed to load local skins", e);
        }
    };

    const handleImportSkin = async () => {
        if (!window.electronAPI?.saveLocalSkin) return;
        try {
            const res = await window.electronAPI.saveLocalSkin();
            if (res.success) {
                addNotification('Skin imported successfully', 'success');
                loadLocalSkins();
            } else if (res.error !== 'Cancelled') {
                addNotification(`Import failed: ${res.error}`, 'error');
            }
        } catch (e) {
            console.error("Import failed", e);
        }
    };

    const handleSelectSkin = async (skin) => {
        setSelectedLocalSkin(skin);
        if (skinViewerRef.current && skin.data) {
            // Use Base64 data which bypasses file:// restrictions
            skinViewerRef.current.loadSkin(skin.data, { model: variant });
            setCurrentSkinUrl(skin.data);
        }
    };

    const handleApplySkin = async () => {
        if (!selectedLocalSkin) return;
        if (!userProfile) {
            addNotification('You must be logged in to upload a skin', 'error');
            return;
        }

        setIsLoading(true);
        // We need to pass the skin PATH to the backend
        const res = await window.electronAPI.uploadSkin(userProfile.access_token, selectedLocalSkin.path, variant);
        setIsLoading(false);

        if (res.success) {
            addNotification('Skin uploaded! It may take a minute to update.', 'success');
            setOriginalSkinUrl(currentSkinUrl); // Update "original" to what we just uploaded (conceptually)
            loadProfileAndSkin(); // Reload to confirm
        } else {
            addNotification(`Upload failed: ${res.error}`, 'error');
        }
    };

    const handleDeleteSkin = async (e, id) => {
        e.stopPropagation();
        const res = await window.electronAPI.deleteLocalSkin(id);
        if (res.success) {
            addNotification('Skin deleted', 'info');
            if (selectedLocalSkin?.id === id) {
                setSelectedLocalSkin(null);
                // Revert viewer to original
                if (skinViewerRef.current && originalSkinUrl) {
                    skinViewerRef.current.loadSkin(originalSkinUrl, { model: variant });
                    setCurrentSkinUrl(originalSkinUrl);
                }
            }
            loadLocalSkins();
        } else {
            addNotification(`Delete failed: ${res.error}`, 'error');
        }
    };

    const handleRename = async (id) => {
        if (!editName.trim()) {
            setEditingSkinId(null);
            return;
        }
        const res = await window.electronAPI.renameLocalSkin(id, editName);
        if (res.success) {
            addNotification('Skin renamed', 'success');
            loadLocalSkins();
        } else {
            addNotification(`Rename failed: ${res.error}`, 'error');
        }
        setEditingSkinId(null);
    };

    return (
        <div className="h-full flex overflow-hidden">
            {/* Left Panel: 3D Preview */}
            <div className="w-1/3 min-w-[300px] bg-background-dark border-r border-white/5 flex flex-col items-center justify-center relative p-6">
                <div className="absolute top-4 left-4 bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                    Beta
                </div>

                <h2 className="absolute top-4 right-4 text-xl font-bold text-white drop-shadow-md">
                    {userProfile?.name || 'Guest'}
                </h2>

                <canvas ref={canvasRef} className="cursor-move" />

                <div className="absolute bottom-6 flex gap-4">
                    <button
                        onClick={() => setIsAnimating(!isAnimating)}
                        className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors text-white"
                        title={isAnimating ? "Pause" : "Play"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {isAnimating ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            )}
                        </svg>
                    </button>

                    <button
                        onClick={() => {
                            const newVariant = variant === 'classic' ? 'slim' : 'classic';
                            setVariant(newVariant);
                            if (skinViewerRef.current && currentSkinUrl) {
                                skinViewerRef.current.loadSkin(currentSkinUrl, { model: newVariant });
                            }
                        }}
                        className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors text-white text-sm font-medium"
                    >
                        Model: {variant === 'classic' ? '(Wide)' : '(Slim)'}
                    </button>

                    {/* Placeholder for Cape */}
                    <button className="bg-white/5 text-gray-500 px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed">
                        Change Cape
                    </button>
                </div>
            </div>

            {/* Right Panel: Skin Library */}
            <div className="flex-1 bg-background p-8 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Skins</h1>
                        <p className="text-gray-400">Manage your appearance</p>
                    </div>
                    {selectedLocalSkin && (
                        <button
                            onClick={handleApplySkin}
                            disabled={isLoading}
                            className="bg-primary hover:bg-primary-hover text-black font-bold px-6 py-2 rounded-xl shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isLoading ? 'Uploading...' : 'Apply to Account'}
                        </button>
                    )}
                </div>

                {/* Local Skins Grid */}
                <div>
                    <h3 className="text-lg font-bold text-gray-300 mb-4">Saved Skins</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {/* Add Skin Button */}
                        <div
                            onClick={handleImportSkin}
                            className="aspect-[3/4] bg-white/5 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-white/10 transition-all group"
                        >
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-gray-400 group-hover:text-white">Add a skin</span>
                        </div>

                        {/* Saved Skins */}
                        {localSkins.map((skin) => (
                            <div
                                key={skin.id}
                                onClick={() => handleSelectSkin(skin)}
                                className={`aspect-[3/4] bg-surface rounded-xl overflow-hidden relative cursor-pointer border-2 transition-all group ${selectedLocalSkin?.id === skin.id ? 'border-primary shadow-primary-glow' : 'border-transparent hover:border-white/20'}`}
                            >
                                {/* We display the 2D texture as preview */}
                                <div className="p-4 flex items-center justify-center h-full bg-[#1a1a1a]">
                                    {/* Simple pixelated rendering of the flat skin? Or just the raw image */}
                                    <img
                                        src={skin.data || `file://${skin.path}`}
                                        alt={skin.name}
                                        className="w-full h-auto object-contain image-pixelated" // CSS class needed for crisp pixels
                                        style={{ imageRendering: 'pixelated' }}
                                    />
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {editingSkinId === skin.id ? (
                                        <input
                                            autoFocus
                                            className="bg-black/80 text-white text-xs font-medium px-2 py-1 rounded border border-primary outline-none w-full"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleRename(skin.id);
                                                if (e.key === 'Escape') setEditingSkinId(null);
                                            }}
                                            onBlur={() => handleRename(skin.id)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span
                                            className="text-white font-medium truncate flex-1 cursor-text"
                                            onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                setEditingSkinId(skin.id);
                                                setEditName(skin.name);
                                            }}
                                        >
                                            {skin.name}
                                        </span>
                                    )}
                                    {editingSkinId !== skin.id && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingSkinId(skin.id);
                                                setEditName(skin.name);
                                            }}
                                            className="text-gray-400 hover:text-white ml-2"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                    )}
                                </div>

                                {/* Delete Button */}
                                <button
                                    onClick={(e) => handleDeleteSkin(e, skin.id)}
                                    className="absolute top-2 right-2 bg-red-500/80 p-1.5 rounded-lg text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Default Skins */}
                <div className="mt-8">
                    <h3 className="text-lg font-bold text-gray-300 mb-4">Default Skins</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {['Steve', 'Alex'].map(name => (
                            <div
                                key={name}
                                onClick={() => {
                                    const url = name === 'Steve'
                                        ? "https://textures.minecraft.net/texture/1a4af718455d4aab528e7a61f86fa25e6a369d1768dcb13f7df319a713eb810b"
                                        : "http://textures.minecraft.net/texture/3b60a1f6d562f52aaebbf1434f1de147933a3affe0e764fa49ea057536623cd3"; // Alex default texture

                                    if (skinViewerRef.current) {
                                        try {
                                            skinViewerRef.current.loadSkin(url, { model: name === 'Steve' ? 'classic' : 'slim' })
                                                .catch(err => {
                                                    console.error('Failed to load default skin:', err);
                                                    addNotification(`Failed to load ${name} skin texture`, 'error');
                                                });
                                            setCurrentSkinUrl(url);
                                            setVariant(name === 'Steve' ? 'classic' : 'slim');
                                            setSelectedLocalSkin(null);
                                        } catch (e) {
                                            console.error('Skin viewer error:', e);
                                        }
                                    }
                                }}
                                className="aspect-[3/4] bg-surface rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer border-2 border-transparent hover:border-white/20 transition-all"
                            >
                                <div className="text-gray-400 font-bold">{name}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Skins;
