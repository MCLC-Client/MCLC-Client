import React, { useState, useEffect } from 'react';
import ExtensionSlot from './Extensions/ExtensionSlot';

function Sidebar({ currentView, setView, onLogout, onInstanceClick, onCreateInstance }) {
    const [recentInstances, setRecentInstances] = useState([]);
    const [settings, setSettings] = useState({ showDisabledFeatures: false });

    useEffect(() => {
        loadRecentInstances();
        const loadSettings = async () => {
            try {
                const res = await window.electronAPI.getSettings();
                if (res.success) setSettings(res.settings);
            } catch (e) {}
        };
        loadSettings();

        const cleanupSettings = window.electronAPI.onSettingsUpdated((newSettings) => {
            setSettings(newSettings);
        });

        const interval = setInterval(loadRecentInstances, 5000);
        return () => {
            clearInterval(interval);
            if (cleanupSettings) cleanupSettings();
        };
    }, []);

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { id: 'library', label: 'Library', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
        { id: 'search', label: 'Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
        { id: 'skins', label: 'Skins', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
        { id: 'extensions', label: 'Extensions', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
        { id: 'styling', label: 'Styling', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
    ];

    const visibleMenuItems = menuItems.filter(item => !item.disabled || settings.showDisabledFeatures);

    const loadRecentInstances = async () => {
        try {
            const list = await window.electronAPI.getInstances();
            if (list) {
                const recent = [...list]
                    .filter(inst => inst.lastPlayed || inst.playtime > 0)
                    .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
                    .slice(0, 3);
                setRecentInstances(recent);
            }
        } catch (e) { }
    };

    return (
        <div className="w-16 my-4 ml-4 mr-2 bg-surface/10 rounded-2xl border border-white/5 shadow-2xl flex flex-col items-center py-6 gap-2 relative z-50"
            style={{ backdropFilter: 'blur(10px)' }}>
            {visibleMenuItems.map((item) => (
                <React.Fragment key={item.id}>
                    <button
                        onClick={() => !item.disabled && setView(item.id)}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all group relative ${currentView === item.id
                            ? 'bg-primary text-black shadow-[0_0_20px_rgba(var(--primary-color-rgb),0.3)]'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            } ${item.disabled ? 'opacity-40 grayscale cursor-not-allowed pointer-events-none' : ''}`}
                    >
                        {typeof item.icon === 'string' ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                            </svg>
                        ) : (
                            item.icon
                        )}

                        { }
                        <div className="absolute left-full ml-2 px-3 py-1.5 bg-[#0d0d0d] border border-white/10 rounded-lg text-xs font-bold text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 shadow-2xl">
                            {item.label}
                            <div className="absolute top-1/2 -left-1 transform -translate-y-1/2 border-4 border-transparent border-r-[#0d0d0d]"></div>
                        </div>
                    </button>
                    {item.id === 'library' && (
                        <div className="w-8 h-[1px] bg-white/10 my-1"></div>
                    )}
                    {item.id === 'styling' && (
                        <>
                            <div className="w-8 h-[1px] bg-white/10 my-1"></div>

                            { }
                            {recentInstances.map((inst) => (
                                <button
                                    key={inst.name}
                                    onClick={() => onInstanceClick && onInstanceClick(inst)}
                                    className="w-10 h-10 rounded-lg flex items-center justify-center transition-all group relative overflow-hidden border border-transparent hover:border-white/10 my-0.5"
                                >
                                    {inst.icon && inst.icon.startsWith('data:') ? (
                                        <img src={inst.icon} alt="" className="w-full h-full object-cover rounded-lg" />
                                    ) : (
                                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                    )}

                                    { }
                                    <div className="absolute left-full ml-2 px-3 py-1.5 bg-[#0d0d0d] border border-white/10 rounded-lg text-xs font-bold text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 shadow-2xl">
                                        {inst.name}
                                        <div className="absolute top-1/2 -left-1 transform -translate-y-1/2 border-4 border-transparent border-r-[#0d0d0d]"></div>
                                    </div>
                                </button>
                            ))}

                            { }
                            {recentInstances.length > 0 && (
                                <div className="w-8 h-[1px] bg-white/10 my-1"></div>
                            )}

                            { }
                            <button
                                onClick={() => onCreateInstance && onCreateInstance()}
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-500 hover:text-primary hover:bg-primary/10 transition-all group relative border border-transparent hover:border-primary/20"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>

                                { }
                                <div className="absolute left-full ml-2 px-3 py-1.5 bg-[#0d0d0d] border border-white/10 rounded-lg text-xs font-bold text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 shadow-2xl">
                                    New Instance
                                    <div className="absolute top-1/2 -left-1 transform -translate-y-1/2 border-4 border-transparent border-r-[#0d0d0d]"></div>
                                </div>
                            </button>
                        </>
                    )}
                </React.Fragment>
            ))}

            <div className="flex-1"></div>

            {/* Settings Button */}
            <button
                onClick={() => setView('settings')}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all group relative ${currentView === 'settings'
                    ? 'bg-primary text-black shadow-[0_0_20px_rgba(var(--primary-color-rgb),0.3)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>

                <div className="absolute left-full ml-2 px-3 py-1.5 bg-[#0d0d0d] border border-white/10 rounded-lg text-xs font-bold text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 shadow-2xl">
                    Settings
                    <div className="absolute top-1/2 -left-1 transform -translate-y-1/2 border-4 border-transparent border-r-[#0d0d0d]"></div>
                </div>
            </button>

            <div className="w-8 h-[1px] bg-white/10 my-2"></div>

            { }
            <button
                onClick={onLogout}
                className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all group relative"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>

                <div className="absolute left-full ml-2 px-3 py-1.5 bg-[#0d0d0d] border border-white/10 rounded-lg text-xs font-bold text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 shadow-2xl">
                    Logout
                    <div className="absolute top-1/2 -left-1 transform -translate-y-1/2 border-4 border-transparent border-r-[#0d0d0d]"></div>
                </div>
            </button>
            {/* Bottom Slot */}
            <ExtensionSlot name="sidebar.bottom" className="w-full flex flex-col items-center gap-2 mt-2" />
        </div>
    );
}

export default Sidebar;