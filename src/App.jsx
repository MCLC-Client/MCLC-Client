import React, { useState, useEffect, useRef } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ServerDashboard from './pages/ServerDashboard';
import ServerDetails from './pages/ServerDetails';
import Search from './pages/Search';
import Settings from './pages/Settings';
import Styling from './pages/Styling';
import Skins from './pages/Skins';
import ServerSettings from './pages/ServerSettings';
import ServerLibrary from './pages/ServerLibrary';
import InstanceDetails from './pages/InstanceDetails';
import Sidebar from './components/Sidebar';
import ServerSidebar from './components/ServerSidebar';
import RightPanel from './components/RightPanel';

function App() {
    const [currentView, setCurrentView] = useState('login');
    const [currentMode, setCurrentMode] = useState('client');
    const [userProfile, setUserProfile] = useState(null);
    const [theme, setTheme] = useState({
        primaryColor: '#1bd96a',
        backgroundColor: '#111111',
        surfaceColor: '#1c1c1c',
        glassBlur: 10,
        glassOpacity: 0.8,
        borderRadius: 12,
        bgMedia: { url: '', type: 'none' }
    });
    const [selectedInstance, setSelectedInstance] = useState(null);
    const [selectedServer, setSelectedServer] = useState(null);
    const [runningInstances, setRunningInstances] = useState({});
    const [activeDownloads, setActiveDownloads] = useState({});
    const [isMaximized, setIsMaximized] = useState(false);

    const [showDownloads, setShowDownloads] = useState(false);
    const [showSessions, setShowSessions] = useState(false);
    const [showModeMenu, setShowModeMenu] = useState(false);

    const downloadsRef = useRef(null);
    const sessionsRef = useRef(null);
    const modeMenuRef = useRef(null);
    const logoRef = useRef(null);

    useEffect(() => {
        const checkSession = async () => {
            if (window.electronAPI.validateSession) {
                const res = await window.electronAPI.validateSession();
                if (res.success) {
                    const profile = await window.electronAPI.getProfile();
                    if (profile) {
                        setUserProfile(profile);
                        setCurrentView('dashboard');
                        return;
                    }
                }
            } else {
                const profile = await window.electronAPI.getProfile();
                if (profile) {
                    setUserProfile(profile);
                    setCurrentView('dashboard');
                }
            }
        };

        const loadTheme = async () => {
            const res = await window.electronAPI.getSettings();
            if (res.success && res.settings.theme) {
                const t = res.settings.theme;
                setTheme(t);
                applyTheme(t);
            }
        };

        checkSession();
        loadTheme();

        const removeThemeListener = window.electronAPI.onThemeUpdated((newTheme) => {
            setTheme(newTheme);
            applyTheme(newTheme);
        });

        const removeStatusListener = window.electronAPI.onInstanceStatus(({ instanceName, status }) => {
            setRunningInstances(prev => {
                const next = { ...prev };
                if (status === 'stopped' || status === 'deleted') {
                    delete next[instanceName];
                } else {
                    next[instanceName] = status;
                }
                return next;
            });

            if (status === 'stopped' || status === 'error' || status === 'ready' || status === 'deleted' || status === 'running') {
                setActiveDownloads(prev => {
                    const next = { ...prev };
                    delete next[instanceName];
                    return next;
                });
            }
        });

        const removeInstallListener = window.electronAPI.onInstallProgress(({ instanceName, progress, status }) => {
            setActiveDownloads(prev => {
                const next = { ...prev };
                if (progress >= 100) {
                    delete next[instanceName];
                } else {
                    next[instanceName] = { progress: progress || prev[instanceName]?.progress || 0, status, type: 'install' };
                }
                return next;
            });
        });

        const handleClickOutside = (event) => {
            if (downloadsRef.current && !downloadsRef.current.contains(event.target)) {
                setShowDownloads(false);
            }
            if (sessionsRef.current && !sessionsRef.current.contains(event.target)) {
                setShowSessions(false);
            }
            if (modeMenuRef.current && !modeMenuRef.current.contains(event.target) &&
                logoRef.current && !logoRef.current.contains(event.target)) {
                setShowModeMenu(false);
            }
        };

        const removeLaunchProgressListener = window.electronAPI.onLaunchProgress((e) => {
            if (!e.instanceName) return;

            setActiveDownloads(prev => {
                const percent = Math.round(e.percent || ((e.done / e.total) * 100) || 0);
                const isSkipEvent = e.type === 'check' || percent >= 100 || (e.total <= 0 && e.type !== 'download');

                if (isSkipEvent) {
                    if (prev[e.instanceName]) {
                        const next = { ...prev };
                        delete next[e.instanceName];
                        return next;
                    }
                    return prev;
                }

                const isSignificantLaunchEvent = e.type === 'download' || e.type === 'assets' || e.type === 'natives' || e.type === 'classes';

                if (!isSignificantLaunchEvent) return prev;

                const next = { ...prev };
                next[e.instanceName] = {
                    progress: percent,
                    status: `Downloading ${e.task || 'Minecraft'}`,
                    type: 'launch'
                };
                return next;
            });
        });

        const removeWindowStateListener = window.electronAPI.onWindowStateChange((maximized) => {
            setIsMaximized(maximized);
        });

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            if (removeInstallListener) removeInstallListener();
            if (removeLaunchProgressListener) removeLaunchProgressListener();
            if (removeStatusListener) removeStatusListener();
            if (removeThemeListener) removeThemeListener();
            if (removeWindowStateListener) removeWindowStateListener();
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const applyTheme = (t) => {
        const root = document.documentElement;
        root.style.setProperty('--primary-color', t.primaryColor);
        root.style.setProperty('--background-color', t.backgroundColor);
        root.style.setProperty('--surface-color', t.surfaceColor);
        root.style.setProperty('--glass-blur', `${t.glassBlur}px`);
        root.style.setProperty('--glass-opacity', t.glassOpacity);
        root.style.setProperty('--border-radius', `${t.borderRadius || 12}px`);
        root.style.setProperty('--panel-opacity', t.glassOpacity);

        const adjustColor = (hex, percent) => {
            if (!hex || typeof hex !== 'string') return '#ffffff';
            const num = parseInt(hex.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = (num >> 16) + amt;
            const G = (num >> 8 & 0x00FF) + amt;
            const B = (num & 0x0000FF) + amt;
            return '#' + (0x1000000 + (R < 255 ? R < 0 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 0 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 0 ? 0 : B : 255)).toString(16).slice(1);
        };

        root.style.setProperty('--primary-hover-color', adjustColor(t.primaryColor, 15));

        const hexToRgb = (hex) => {
            if (!hex || typeof hex !== 'string') return '28, 28, 28';
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `${r}, ${g}, ${b}`;
        };
        root.style.setProperty('--surface-color-rgb', hexToRgb(t.surfaceColor));
        root.style.setProperty('--primary-color-rgb', hexToRgb(t.primaryColor));

        const darken = (hex, percent) => {
            if (!hex || typeof hex !== 'string') return '#000000';
            const num = parseInt(hex.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = (num >> 16) - amt;
            const G = (num >> 8 & 0x00FF) - amt;
            const B = (num & 0x0000FF) - amt;
            return '#' + (0x1000000 + (R < 255 ? R < 0 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 0 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 0 ? 0 : B : 255)).toString(16).slice(1);
        };
        root.style.setProperty('--background-dark-color', darken(t.backgroundColor, 20));

        if (t.bgMedia && t.bgMedia.url) {
            root.style.setProperty('--bg-url', t.bgMedia.url);
            root.style.setProperty('--bg-type', t.bgMedia.type);
        } else {
            root.style.setProperty('--bg-url', '');
            root.style.setProperty('--bg-type', 'none');
        }
    };

    const handleLoginSuccess = (profile) => {
        setUserProfile(profile);
        setCurrentView('dashboard');
        setCurrentMode('client');
    };

    const handleLogout = () => {
        setUserProfile(null);
        setCurrentView('login');
    };

    const handleInstanceClick = (instance) => {
        setSelectedInstance(instance);
        setCurrentView('instance-details');
    };

    const handleServerClick = (server) => {
        setSelectedServer(server);
        setCurrentView('server-details');
    };

    const handleInstanceUpdate = (updatedInstance) => {
        setSelectedInstance(updatedInstance);
    };

    const handleServerUpdate = (updatedServer) => {
        setSelectedServer(updatedServer);
    };

    const handleBackToDashboard = () => {
        setSelectedInstance(null);
        setSelectedServer(null);
        setCurrentView(currentMode === 'client' ? 'dashboard' : 'server-dashboard');
    };

    const handleModeSelect = (mode) => {
        setCurrentMode(mode);
        setCurrentView(mode === 'client' ? 'dashboard' : 'server-dashboard');
        setSelectedInstance(null);
        setSelectedServer(null);
        setShowModeMenu(false);
    };

    const toggleModeMenu = () => {
        setShowModeMenu(!showModeMenu);
    };

    const activeDownloadCount = Object.keys(activeDownloads).length;
    const runningCount = Object.keys(runningInstances).filter(k => runningInstances[k] === 'running').length;
    const isAnyActive = activeDownloadCount > 0;

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-white font-sans selection:bg-primary selection:text-black relative">

            {/* Background Layer */}
            {userProfile && theme?.bgMedia?.url && theme.bgMedia.url.trim() !== '' && (
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    {theme.bgMedia.type === 'video' ? (
                        <video
                            key={theme.bgMedia.url}
                            autoPlay muted loop
                            className="w-full h-full object-cover"
                        >
                            <source src={`app-media:///${theme.bgMedia.url.replace(/\\/g, '/')}`} type="video/mp4" />
                        </video>
                    ) : (
                        <img
                            key={theme.bgMedia.url}
                            src={`app-media:///${theme.bgMedia.url.replace(/\\/g, '/')}`}
                            className="w-full h-full object-cover"
                            alt=""
                        />
                    )}
                    <div
                        className="absolute inset-0 bg-black pointer-events-none"
                        style={{ opacity: 1 - (parseFloat(theme.glassOpacity) || 0.8) }}
                    />
                </div>
            )}

            {/* Title Bar */}
            <div
                className="h-16 w-full titlebar z-50 flex justify-between items-center pl-2 pr-6 bg-surface/30 border-b border-white/5 flex-none relative"
                style={{ backdropFilter: `blur(${theme.glassBlur}px)` }}
            >
                <div className="flex items-center gap-2 drag no-drag">
                    <div className="relative" ref={logoRef}>
                        <div
                            onClick={toggleModeMenu}
                            className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary font-bold text-2xl hover:bg-primary/30 transition-colors cursor-pointer pointer-events-auto shadow-lg border border-primary/20"
                        >
                            M
                        </div>

                        {showModeMenu && (
                            <div
                                ref={modeMenuRef}
                                className="absolute top-14 left-0 w-48 bg-[#0d0d0d] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-100 z-[100]"
                            >
                                <button
                                    onClick={() => handleModeSelect('client')}
                                    className={`w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3 ${currentMode === 'client' ? 'bg-primary/10 text-primary' : 'text-gray-200'}`}
                                >
                                    <span className="text-lg">🎮</span>
                                    <span className="font-medium">Client</span>
                                    {currentMode === 'client' && (
                                        <svg className="h-4 w-4 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </button>
                                <button
                                    onClick={() => handleModeSelect('server')}
                                    className={`w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3 ${currentMode === 'server' ? 'bg-primary/10 text-primary' : 'text-gray-200'}`}
                                >
                                    <span className="text-lg">🖥️</span>
                                    <span className="font-medium">Server</span>
                                    {currentMode === 'server' && (
                                        <svg className="h-4 w-4 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4 no-drag h-full">
                    {/* Running Instances Indicator */}
                    <div className="relative h-full flex items-center" ref={sessionsRef}>
                        <button
                            onClick={() => setShowSessions(!showSessions)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-white/20 hover:bg-[#252525] rounded-full transition-all group shadow-lg"
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${runningCount > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                            <span className="text-[10px] font-bold text-gray-100">
                                {runningCount === 0 ? 'Idle' : `${runningCount} Running`}
                            </span>
                        </button>

                        {showSessions && (
                            <div className="absolute top-14 right-0 w-64 bg-[#0d0d0d] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-2 animate-in fade-in zoom-in duration-100 z-[100]">
                                {Object.keys(runningInstances).length === 0 ? (
                                    <div className="px-4 py-2 text-xs text-gray-400 italic">No active sessions</div>
                                ) : (
                                    Object.entries(runningInstances).map(([name, status]) => (
                                        <div key={name} className="flex items-center justify-between px-4 py-2 hover:bg-white/5 group">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <div className={`shrink-0 w-2 h-2 rounded-full ${status === 'running' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                                                <span className="text-sm font-medium truncate text-gray-200">{name}</span>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => window.electronAPI.killGame(name)}
                                                    className="p-1 hover:bg-red-500/20 text-red-500 rounded transition-colors"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="6" y="6" width="12" height="12" strokeWidth={2} /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Downloads Indicator */}
                    <div className="relative h-full flex items-center" ref={downloadsRef}>
                        <button
                            onClick={() => setShowDownloads(!showDownloads)}
                            className={`p-1.5 rounded-lg transition-all relative ${isAnyActive ? 'text-primary bg-[#1a1a1a] border border-primary/50' : 'text-gray-200 hover:text-white bg-[#1a1a1a] border border-white/20'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isAnyActive ? 'animate-bounce' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            {isAnyActive && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-primary border border-background rounded-full"></span>
                            )}
                        </button>

                        {showDownloads && (
                            <div className="absolute top-14 right-0 w-64 bg-[#0d0d0d] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-3 animate-in fade-in slide-in-from-top-2 duration-100 z-[100]">
                                <div className="px-4 pb-2 border-b border-white/5 mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Downloads</span>
                                </div>
                                <div className="max-h-60 overflow-y-auto px-4 space-y-3">
                                    {Object.keys(activeDownloads).length === 0 ? (
                                        <div className="py-2 text-center text-xs text-gray-500">No active tasks</div>
                                    ) : (
                                        Object.entries(activeDownloads).map(([name, data]) => (
                                            <div key={name} className="space-y-1">
                                                <div className="flex justify-between items-center overflow-hidden">
                                                    <span className="text-xs font-bold text-white truncate pr-2">{name}</span>
                                                    <span className="text-[10px] font-mono text-primary">{data.progress}%</span>
                                                </div>
                                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${data.progress}%` }}></div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Custom Window Controls */}
                    <div className="flex gap-1 border-l border-white/5 pl-4">
                        <button onClick={() => window.electronAPI.minimize()} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                        </button>
                        <button onClick={() => window.electronAPI.maximize()} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors">
                            {isMaximized ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3.75v4.5m0 0H4.5m4.5 0L3.75 3.75M9 20.25v-4.5m0 0H4.5m4.5 0L3.75 20.25M15 3.75v4.5m0 0h4.5m-4.5 0l5.25-5.25M15 20.25v-4.5m0 0h4.5m-4.5 0l5.25 5.25" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                                </svg>
                            )}
                        </button>
                        <button onClick={() => window.electronAPI.close()} className="p-1.5 hover:bg-red-500 rounded text-gray-400 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {userProfile ? (
                <div className="flex flex-1 overflow-hidden">
                    {/* Dynamische Sidebar basierend auf Mode */}
                    {currentMode === 'client' ? (
                        <Sidebar currentView={currentView} setView={setCurrentView} onLogout={handleLogout} />
                    ) : (
                        <ServerSidebar currentView={currentView} setView={setCurrentView} onLogout={handleLogout} />
                    )}

                    <main className="flex-1 my-4 ml-4 mr-2 bg-surface/10 relative overflow-hidden flex flex-col rounded-2xl border border-white/5 shadow-2xl"
                        style={{ backdropFilter: `blur(${theme.glassBlur}px)` }}
                    >
                        <div className="flex-1 overflow-hidden bg-surface/20 rounded-2xl relative flex flex-col">
                            {/* Client Views */}
                            {currentMode === 'client' && (
                                <>
                                    {currentView === 'dashboard' && <Dashboard onInstanceClick={handleInstanceClick} runningInstances={runningInstances} />}
                                    {currentView === 'search' && <Search />}
                                    {currentView === 'skins' && <Skins onLogout={handleLogout} />}
                                    {currentView === 'styling' && <Styling />}
                                    {currentView === 'settings' && <Settings />}
                                    {currentView === 'instance-details' && selectedInstance && (
                                        <InstanceDetails instance={selectedInstance} onBack={handleBackToDashboard} runningInstances={runningInstances} onInstanceUpdate={handleInstanceUpdate} />
                                    )}
                                </>
                            )}

                            {/* Server Views */}
                            {currentMode === 'server' && (
                                <>
                                    {currentView === 'server-dashboard' && <ServerDashboard onServerClick={handleServerClick} runningInstances={runningInstances} />}
                                    {currentView === 'server-details' && selectedServer && (
                                        <ServerDetails
                                            server={selectedServer}
                                            onBack={handleBackToDashboard}
                                            runningInstances={runningInstances}
                                            onServerUpdate={handleServerUpdate}
                                        />
                                    )}
                                    {currentView === 'search' && <Search />}
                                    {currentView === 'styling' && <Styling />}
                                    {currentView === 'server-library' && <ServerLibrary />}
                                    {currentView === 'server-settings' && <ServerSettings />}
                                </>
                            )}
                        </div>
                    </main>

                    <div
                        className="my-4 ml-2 mr-4 bg-surface/10 z-10 flex flex-col rounded-2xl border border-white/5 shadow-2xl"
                        style={{ backdropFilter: `blur(${theme.glassBlur}px)` }}
                    >
                        <div className="flex-1 overflow-hidden">
                            <RightPanel userProfile={userProfile} onProfileUpdate={setUserProfile} />
                        </div>
                    </div>
                </div>
            ) : (
                <main className="flex-1 relative overflow-hidden">
                    <Login onLoginSuccess={handleLoginSuccess} />
                </main>
            )}
        </div>
    );
}

export default App;