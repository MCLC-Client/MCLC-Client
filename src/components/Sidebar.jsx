import React, { useState, useEffect } from 'react';
import ExtensionSlot from './Extensions/ExtensionSlot';
import { useTranslation } from 'react-i18next';

function Sidebar({ currentView, setView, onLogout, onInstanceClick, onCreateInstance, isGuest, isCollapsed, setIsCollapsed }) {
    const { t } = useTranslation();
    const [recentInstances, setRecentInstances] = useState([]);
    const [settings, setSettings] = useState({ showDisabledFeatures: false });
    const getLabelClasses = (baseClasses, expandedWidth = 'max-w-[10rem]') => (
        `${baseClasses} absolute top-1/2 left-12 right-3 min-w-0 -translate-y-1/2 overflow-hidden whitespace-nowrap text-left transition-[max-width,opacity] duration-300 ease-in-out ${isCollapsed ? 'max-w-0 opacity-0' : `${expandedWidth} opacity-100`}`
    );
    const getIconClasses = () => (
        `absolute top-1/2 left-[11px] flex h-6 w-6 -translate-y-1/2 items-center justify-center`
    );
    const dividerClassName = `h-[1px] bg-white/10 shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-8' : 'w-full'}`;

    useEffect(() => {
        loadRecentInstances();
        const loadSettings = async () => {
            try {
                const res = await window.electronAPI.getSettings();
                if (res.success) setSettings(res.settings);
            } catch (e) { }
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
        { id: 'dashboard', label: t('common.dashboard'), icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { id: 'library', label: t('common.library'), icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
        { id: 'search', label: t('common.search'), icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
        { id: 'skins', label: t('common.skins'), icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', disabled: isGuest },
        { id: 'extensions', label: t('common.extensions'), icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
        { id: 'styling', label: t('common.styling'), icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
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
        <div className={`transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-56'} my-4 ml-4 mr-2 bg-surface/10 rounded-2xl border border-white/5 flex flex-col items-center pb-6 relative z-50`}
            style={{
                backdropFilter: 'blur(10px)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45), 0 0 calc(var(--sidebar-glow-intensity, 0) * 32px) rgba(var(--primary-color-rgb), calc(var(--sidebar-glow-intensity, 0) * 0.55))'
            }}>

            <div className="w-full px-2 pt-4 mb-2">
                <div className="relative h-9">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsCollapsed(!isCollapsed);
                        }}
                        className="absolute top-0 p-2 text-gray-400 hover:text-white transition-all duration-300 ease-in-out rounded-lg hover:bg-white/5 group/toggle"
                        style={{
                            left: isCollapsed ? '50%' : '100%',
                            transform: isCollapsed ? 'translateX(-50%)' : 'translateX(-100%)'
                        }}
                        title={isCollapsed ? t('common.expand', 'Expand') : t('common.collapse', 'Collapse')}
                    >
                        <div
                            className="transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                            style={{
                                transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)'
                            }}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                        </div>
                    </button>
                </div>
            </div>

            <div className="flex-1 w-full px-2 flex flex-col items-center gap-2">
                {visibleMenuItems.map((item) => (
                    <React.Fragment key={item.id}>
                        <button
                            onClick={() => !item.disabled && setView(item.id)}
                            className={`h-12 w-full rounded-xl relative transition-all duration-300 ease-in-out group shrink-0 overflow-hidden ${currentView === item.id
                                ? 'bg-primary text-black global-primary-glow'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                } ${item.disabled ? 'opacity-40 grayscale cursor-not-allowed pointer-events-none' : ''}`}
                        >
                            <div className={getIconClasses()}>
                                {typeof item.icon === 'string' ? (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                                    </svg>
                                ) : (
                                    item.icon
                                )}
                            </div>

                            <span className={getLabelClasses('text-sm font-bold')}>
                                {item.label}
                            </span>

                            {isCollapsed && (
                                <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#0d0d0d] border border-white/10 rounded-lg text-xs font-bold text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-[100] shadow-2xl">
                                    {item.id === 'skins' && isGuest ? t('login.guest_restriction', 'Login required') : item.label}
                                    <div className="absolute top-1/2 -left-1 transform -translate-y-1/2 border-4 border-transparent border-r-[#0d0d0d]"></div>
                                </div>
                            )}
                        </button>
                        {item.id === 'library' && (
                            <div className="w-full px-2 my-1 flex justify-center shrink-0">
                                <div className={dividerClassName}></div>
                            </div>
                        )}
                        {item.id === 'styling' && (
                            <>
                                <div className="w-full px-2 my-1 flex justify-center shrink-0">
                                    <div className={dividerClassName}></div>
                                </div>

                                {recentInstances.map((inst) => (
                                    <button
                                        key={inst.name}
                                        onClick={() => onInstanceClick && onInstanceClick(inst)}
                                        className="h-10 w-full rounded-lg relative transition-all duration-300 ease-in-out group shrink-0 overflow-hidden border border-transparent hover:border-white/10 my-0.5"
                                    >
                                        <div className={getIconClasses()}>
                                            {inst.icon && inst.icon.startsWith('data:') ? (
                                                <img src={inst.icon} alt="" className="w-full h-full object-cover rounded-lg" />
                                            ) : (
                                                <svg className="w-full h-full text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                </svg>
                                            )}
                                        </div>

                                        <span className={getLabelClasses('text-xs font-medium text-gray-300 group-hover:text-white transition-[color,max-width,opacity] duration-300 ease-in-out', 'max-w-[9rem]')}>
                                            {inst.name}
                                        </span>

                                        {isCollapsed && (
                                            <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#0d0d0d] border border-white/10 rounded-lg text-xs font-bold text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-[100] shadow-2xl">
                                                {inst.name}
                                                <div className="absolute top-1/2 -left-1 transform -translate-y-1/2 border-4 border-transparent border-r-[#0d0d0d]"></div>
                                            </div>
                                        )}
                                    </button>
                                ))}

                                {recentInstances.length > 0 && (
                                    <div className="w-full px-2 my-1 flex justify-center shrink-0">
                                        <div className={dividerClassName}></div>
                                    </div>
                                )}

                                <button
                                    onClick={() => onCreateInstance && onCreateInstance()}
                                    className="h-10 w-full rounded-lg relative text-gray-400 hover:text-primary hover:bg-primary/10 transition-all duration-300 ease-in-out group shrink-0 overflow-hidden border border-transparent hover:border-primary/20"
                                >
                                    <div className={getIconClasses()}>
                                        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </div>

                                    <span className={getLabelClasses('text-xs font-bold uppercase tracking-wider', 'max-w-[9rem]')}>
                                        {t('common.new_instance')}
                                    </span>

                                    {isCollapsed && (
                                        <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#0d0d0d] border border-white/10 rounded-lg text-xs font-bold text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-[100] shadow-2xl">
                                            {t('common.new_instance')}
                                            <div className="absolute top-1/2 -left-1 transform -translate-y-1/2 border-4 border-transparent border-r-[#0d0d0d]"></div>
                                        </div>
                                    )}
                                </button>
                            </>
                        )}
                    </React.Fragment>
                ))}
            </div>

            <div className="w-full px-2 mt-4 flex flex-col items-center gap-2">
                <button
                    onClick={() => setView('settings')}
                    className={`h-12 w-full rounded-xl relative transition-all duration-300 ease-in-out group shrink-0 overflow-hidden ${currentView === 'settings'
                        ? 'bg-primary text-black global-primary-glow'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <div className={getIconClasses()}>
                        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>

                    <span className={getLabelClasses('text-sm font-bold')}>
                        {t('common.settings')}
                    </span>

                    {isCollapsed && (
                        <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#0d0d0d] border border-white/10 rounded-lg text-xs font-bold text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-[100] shadow-2xl">
                            {t('common.settings')}
                            <div className="absolute top-1/2 -left-1 transform -translate-y-1/2 border-4 border-transparent border-r-[#0d0d0d]"></div>
                        </div>
                    )}
                </button>

                <div className="w-full px-2 my-1 flex justify-center shrink-0">
                    <div className={dividerClassName}></div>
                </div>

                <button
                    onClick={onLogout}
                    className="h-12 w-full rounded-xl relative transition-all duration-300 ease-in-out group shrink-0 overflow-hidden text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                >
                    <div className={getIconClasses()}>
                        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </div>

                    <span className={getLabelClasses('text-sm font-bold')}>
                        {t('common.logout')}
                    </span>

                    {isCollapsed && (
                        <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#0d0d0d] border border-white/10 rounded-lg text-xs font-bold text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-[100] shadow-2xl">
                            {t('common.logout')}
                            <div className="absolute top-1/2 -left-1 transform -translate-y-1/2 border-4 border-transparent border-r-[#0d0d0d]"></div>
                        </div>
                    )}
                </button>

                <ExtensionSlot name="sidebar.bottom" className="w-full flex flex-col items-center gap-2 mt-2" />
            </div>
        </div>
    );
}

export default Sidebar;



