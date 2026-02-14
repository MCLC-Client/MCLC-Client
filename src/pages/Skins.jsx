import React, { useEffect, useRef, useState } from 'react';
import { SkinViewer, WalkingAnimation, IdleAnimation } from 'skinview3d';
import { useNotification } from '../context/NotificationContext';

// Helper Components for Previews
const SkinPreview = ({ src, className, model = 'classic' }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas || !src) return;
            const ctx = canvas.getContext('2d');

            // Scaling factor for "High Quality"
            const scale = 8;
            canvas.width = 16 * scale;
            canvas.height = 32 * scale;
            ctx.imageSmoothingEnabled = false;

            const img = new Image();
            img.src = src;
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const isSlim = model === 'slim';
                const armWidth = isSlim ? 3 : 4;

                // Function to draw a part with optional shadow/depth
                const drawPart = (sx, sy, sw, sh, dx, dy, dw, dh, shadow = false) => {
                    if (shadow) {
                        ctx.fillStyle = 'rgba(0,0,0,0.15)';
                        ctx.fillRect(dx * scale, (dy + 0.5) * scale, dw * scale, dh * scale);
                    }
                    ctx.drawImage(img, sx, sy, sw, sh, dx * scale, dy * scale, dw * scale, dh * scale);
                };

                // --- Base Body (Inner) ---
                // Legs
                // Right Leg (Viewer Left)
                drawPart(4, 20, 4, 12, 4, 20, 4, 12);
                // Left Leg (Viewer Right)
                if (img.height === 64) drawPart(20, 52, 4, 12, 8, 20, 4, 12);
                else {
                    ctx.save();
                    ctx.scale(-1, 1);
                    drawPart(4, 20, 4, 12, -12, 20, 4, 12);
                    ctx.restore();
                }

                // Body
                drawPart(20, 20, 8, 12, 4, 8, 8, 12);

                // Arms
                // Right Arm Front (Viewer Left)
                drawPart(44, 20, armWidth, 12, 4 - armWidth, 8, armWidth, 12);
                // Left Arm Front (Viewer Right)
                if (img.height === 64) drawPart(36, 52, armWidth, 12, 12, 8, armWidth, 12);
                else {
                    ctx.save();
                    ctx.scale(-1, 1);
                    drawPart(44, 20, 4, 12, -16, 8, 4, 12);
                    ctx.restore();
                }

                // Head
                drawPart(8, 8, 8, 8, 4, 0, 8, 8, true);

                // --- Outer Layers ---
                if (img.height === 64) {
                    // Pants
                    drawPart(4, 36, 4, 12, 4, 20, 4, 12); // Right
                    drawPart(4, 52, 4, 12, 8, 20, 4, 12); // Left
                    // Jacket
                    drawPart(20, 36, 8, 12, 4, 8, 8, 12);
                    // Sleeves
                    drawPart(44, 36, armWidth, 12, 4 - armWidth, 8, armWidth, 12); // Right
                    drawPart(52, 52, armWidth, 12, 12, 8, armWidth, 12); // Left
                }
                // Hat (Always there even in 64x32)
                drawPart(40, 8, 8, 8, 4, 0, 8, 8);
            };
        };
        render();
    }, [src, model]);

    return <canvas ref={canvasRef} className={`w-full h-full object-contain image-pixelated ${className}`} />;
};

const CapePreview = ({ src, className }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas || !src) return;
            const ctx = canvas.getContext('2d');

            const scale = 8;
            canvas.width = 10 * scale;
            canvas.height = 16 * scale;
            ctx.imageSmoothingEnabled = false;

            const img = new Image();
            img.src = src;
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Cape Back: 12, 1, 10, 16
                ctx.drawImage(img, 12, 1, 10, 16, 0, 0, 10 * scale, 16 * scale);
            };
        };
        render();
    }, [src]);

    return <canvas ref={canvasRef} className={`w-full h-full object-contain image-pixelated ${className}`} />;
};

function Skins({ onLogout }) {
    const { addNotification } = useNotification();
    const canvasRef = useRef(null);
    const skinViewerRef = useRef(null);

    // State
    const [currentSkinUrl, setCurrentSkinUrl] = useState(null); // The one on the character (Mojang)
    const [localSkins, setLocalSkins] = useState([]);

    // We track "selected" state for applying.
    // If from local file: {type: 'local', ...skinObj }
    // If from default URL: {type: 'url', url: '...', model: '...' }
    const [pendingSkin, setPendingSkin] = useState(null);

    const [variant, setVariant] = useState('classic'); // classic (Steve) or slim (Alex)
    const [isAnimating, setIsAnimating] = useState(true);
    const [isLoading, setIsLoading] = useState(false); // Global loading (e.g. uploading)
    const [isSkinLoaded, setIsSkinLoaded] = useState(false); // Valid skin loaded in viewer?

    const [editingSkinId, setEditingSkinId] = useState(null);
    const [editName, setEditName] = useState('');

    const [userProfile, setUserProfile] = useState(null);

    const [capes, setCapes] = useState([]);
    const [activeCapeId, setActiveCapeId] = useState(null);
    const [showCapeModal, setShowCapeModal] = useState(false);

    // Initialize Viewer
    useEffect(() => {
        if (!canvasRef.current) return;

        const viewer = new SkinViewer({
            canvas: canvasRef.current,
            width: 300,
            height: 400,
            skin: null // Start empty to avoid Steve flash
        });

        viewer.fov = 70;
        viewer.zoom = 0.9;
        viewer.animation = new WalkingAnimation();
        viewer.autoRotate = false; // Disable rotation as requested
        viewer.autoRotateSpeed = 0.5;

        // Quality settings
        // Force pixelated rendering for crisp skins
        if (canvasRef.current) {
            canvasRef.current.style.imageRendering = "pixelated";
        }
        viewer.renderer.setPixelRatio(window.devicePixelRatio);

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
                // Resize logic if needed
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

    const updateSkinInViewer = async (url, model) => {
        if (!skinViewerRef.current) return;
        try {
            await skinViewerRef.current.loadSkin(url, { model: model?.toLowerCase() || 'classic' });

            // Ensure all layers are always visible
            ["head", "body", "rightArm", "leftArm", "rightLeg", "leftLeg"].forEach(part => {
                if (skinViewerRef.current.playerObject.skin[part]) {
                    skinViewerRef.current.playerObject.skin[part].innerLayer.visible = true;
                    skinViewerRef.current.playerObject.skin[part].outerLayer.visible = true;
                }
            });

            // Restore cape
            const activeCape = capes.find(c => c.id === activeCapeId);
            if (activeCape) skinViewerRef.current.loadCape(activeCape.url);

            setIsSkinLoaded(true);
        } catch (e) {
            console.error("Failed to update skin viewer", e);
        }
    }

    const loadProfileAndSkin = async () => {
        setIsLoading(true);
        try {
            if (!window.electronAPI?.getProfile) return;

            // 1. Validate Session first
            if (window.electronAPI.validateSession) {
                const val = await window.electronAPI.validateSession();
                if (!val.success) {
                    if (onLogout) {
                        onLogout();
                    } else {
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
                        const skinUrl = res.url;
                        const model = res.variant || 'classic';

                        setCurrentSkinUrl(skinUrl);
                        setVariant(model);
                        setCapes(res.capes || []);

                        const activeCape = (res.capes || []).find(c => c.state === 'ACTIVE');
                        setActiveCapeId(activeCape ? activeCape.id : null);

                        await updateSkinInViewer(skinUrl, model);
                    } else {
                        if (res.authError) {
                            console.warn("Session expired detected in Skins tab, logging out...");
                            addNotification('Session expired. Please login again.', 'error');
                            if (onLogout) onLogout();
                            return;
                        }
                        addNotification(`Skin error: ${res.error}`, 'info');
                        setIsSkinLoaded(true); // Still allow showing guest if no skin
                    }
                } catch (e) {
                    console.error("Failed to load skin", e);
                    addNotification('Failed to fetch skin from Mojang. Check your connection.', 'error');
                }
            }
        } catch (e) {
            console.error("Failed to load profile/skin", e);
            addNotification('Failed to load profile. Please try logging in again.', 'error');
        }
        setIsLoading(false);
    };

    const loadLocalSkins = async () => {
        try {
            if (!window.electronAPI?.getLocalSkins) return;
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

    const handleSelectLocalSkin = async (skin) => {
        setPendingSkin({ type: 'local', ...skin });
        if (skin.data) {
            await updateSkinInViewer(skin.data, variant);
        }
    };

    const handleSelectDefaultSkin = async (name) => {
        const url = name === 'Steve'
            ? "https://textures.minecraft.net/texture/1a4af718455d4aab528e7a61f86fa25e6a369d1768dcb13f7df319a713eb810b"
            : "http://textures.minecraft.net/texture/3b60a1f6d562f52aaebbf1434f1de147933a3affe0e764fa49ea057536623cd3";
        const model = name === 'Steve' ? 'classic' : 'slim';

        setPendingSkin({ type: 'url', url, model, name });
        setVariant(model);

        await updateSkinInViewer(url, model);
    };

    const handleApplySkin = async () => {
        if (!pendingSkin) return;
        if (!userProfile) {
            addNotification('You must be logged in to upload a skin', 'error');
            return;
        }

        setIsLoading(true);
        let res;

        try {
            if (pendingSkin.type === 'local') {
                res = await window.electronAPI.uploadSkin(userProfile.access_token, pendingSkin.path, variant);
            } else if (pendingSkin.type === 'url') {
                // New backend handler for URL uploads
                res = await window.electronAPI.uploadSkinFromUrl(userProfile.access_token, pendingSkin.url, variant);
            }

            if (res.success) {
                addNotification('Skin uploaded! It may take a minute to update.', 'success');
                setPendingSkin(null);
                // Reload to sync everything
                loadProfileAndSkin();
            } else {
                if (res.authError) {
                    addNotification('Session expired. Please login again.', 'error');
                    if (onLogout) onLogout();
                } else {
                    addNotification(`Upload failed: ${res.error}`, 'error');
                }
            }
        } catch (e) {
            console.error(e);
            addNotification('Upload failed due to an error.', 'error');
        }

        setIsLoading(false);
    };

    const handleSetCape = async (capeId) => {
        if (!userProfile) return;
        setIsLoading(true);
        const res = await window.electronAPI.setCape(userProfile.access_token, capeId);
        setIsLoading(false);

        if (res.success) {
            const cape = capes.find(c => c.id === capeId);
            setActiveCapeId(capeId);
            if (skinViewerRef.current) {
                skinViewerRef.current.loadCape(cape ? cape.url : null);
            }
            setShowCapeModal(false);
            addNotification(capeId ? 'Cape activated' : 'Cape removed', 'success');
        } else {
            if (res.authError) {
                addNotification('Session expired. Please login again.', 'error');
                if (onLogout) onLogout();
            } else {
                addNotification(`Failed to set cape: ${res.error}`, 'error');
            }
        }
    };

    const handleDeleteSkin = async (e, id) => {
        e.stopPropagation();
        const res = await window.electronAPI.deleteLocalSkin(id);
        if (res.success) {
            addNotification('Skin deleted', 'info');
            if (pendingSkin?.id === id) {
                setPendingSkin(null);
                // Revert to current actual skin
                if (skinViewerRef.current && currentSkinUrl) {
                    await updateSkinInViewer(currentSkinUrl, variant);
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
        <div className="h-full flex overflow-hidden relative">
            {/* Cape Selection Modal */}
            {showCapeModal && (
                <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-8 backdrop-blur-sm">
                    <div className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-full flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white">Select a Cape</h2>
                            <button onClick={() => setShowCapeModal(false)} className="text-gray-400 hover:text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar p-1">
                            {/* No Cape Option */}
                            <div
                                onClick={() => handleSetCape(null)}
                                className={`aspect-[3/4] rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all ${activeCapeId === null ? 'border-primary bg-primary/10' : 'border-white/10 hover:border-white/30 bg-black/20'}`}
                            >
                                <div className="text-gray-400 font-bold">No Cape</div>
                            </div>

                            {capes.map(cape => (
                                <div
                                    key={cape.id}
                                    onClick={() => handleSetCape(cape.id)}
                                    className={`aspect-[3/4] rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden ${activeCapeId === cape.id ? 'border-primary bg-primary/10' : 'border-white/10 hover:border-white/30 bg-black/20'}`}
                                >
                                    <div className="h-1/2 w-full p-2 flex items-center justify-center">
                                        <CapePreview src={cape.url} />
                                    </div>
                                    <span className="text-sm font-medium text-white text-center px-2">{cape.alias}</span>
                                    {activeCapeId === cape.id && (
                                        <div className="absolute top-2 right-2 bg-primary text-black text-xs font-bold px-2 py-0.5 rounded-full">
                                            Active
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Left Panel: 3D Preview */}
            <div className="w-1/3 min-w-[300px] bg-background-dark border-r border-white/5 flex flex-col items-center justify-center relative p-6">
                <div className="absolute top-4 left-4 bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                    Beta
                </div>

                <h2 className="absolute top-4 right-4 text-xl font-bold text-white drop-shadow-md">
                    {userProfile?.name || 'Guest'}
                </h2>

                <div className={`relative w-full h-[400px] flex items-center justify-center transition-opacity duration-300 ${isSkinLoaded ? 'opacity-100' : 'opacity-0'}`}>
                    <canvas ref={canvasRef} className="cursor-move outline-none" />
                </div>

                {/* Fallback Loader while Skin is loading */}
                {!isSkinLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}

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
                            // If we have a pending skin, reload that
                            const url = pendingSkin?.url || pendingSkin?.data || currentSkinUrl;
                            if (skinViewerRef.current && url) {
                                updateSkinInViewer(url, newVariant);
                            }
                        }}
                        className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors text-white text-sm font-medium"
                    >
                        Model: {variant === 'classic' ? '(Wide)' : '(Slim)'}
                    </button>

                    <button
                        onClick={() => setShowCapeModal(true)}
                        disabled={!capes.length}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!capes.length ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                    >
                        {capes.length ? 'Change Cape' : 'No Capes'}
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
                    {pendingSkin && (
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
                                onClick={() => handleSelectLocalSkin(skin)}
                                className={`aspect-[3/4] bg-surface rounded-xl overflow-hidden relative cursor-pointer border-2 transition-all group ${pendingSkin?.id === skin.id ? 'border-primary shadow-primary-glow' : 'border-transparent hover:border-white/20'}`}
                            >
                                <div className="p-4 flex items-center justify-center h-full bg-[#1a1a1a]">
                                    <SkinPreview src={skin.data || `file://${skin.path}`} />
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
                                onClick={() => handleSelectDefaultSkin(name)}
                                className={`aspect-[3/4] bg-surface rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer border-2 transition-all ${pendingSkin?.name === name ? 'border-primary shadow-primary-glow' : 'border-transparent hover:border-white/20'}`}
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
