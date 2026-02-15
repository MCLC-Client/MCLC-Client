import React, { useState, useEffect } from 'react';
import PlayerHead from './PlayerHead';
import OptimizedImage from './OptimizedImage';
import * as ReactWindow from 'react-window';
const { FixedSizeList } = ReactWindow;
import { AutoSizer } from 'react-virtualized-auto-sizer';
const formatUUID = (uuid) => {
    if (!uuid) return null;
    if (uuid.includes('-')) return uuid;
    return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
};

function RightPanel({ userProfile, onProfileUpdate }) {
    const [showSwitcher, setShowSwitcher] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [newsItems, setNewsItems] = useState([]);
    const [liveSkin, setLiveSkin] = useState(null);

    useEffect(() => {
        if (userProfile?.access_token) {
            loadLiveSkin();
        } else {
            setLiveSkin(null);
        }
    }, [userProfile]);

    const loadLiveSkin = async () => {
        try {
            const res = await window.electronAPI.getCurrentSkin(userProfile.access_token);
            if (res.success && res.url) {
                setLiveSkin(res.url);
            }
        } catch (e) {
            console.error("Failed to load live skin", e);
        }
    };

    useEffect(() => {
        if (showSwitcher) {
            loadAccounts();
        }
    }, [showSwitcher]);

    useEffect(() => {
        loadNews();
        const interval = setInterval(loadNews, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadNews = async () => {
        if (window.electronAPI.getNews) {

            const res = await window.electronAPI.getNews();

            if (res.success) {
                setNewsItems(res.news);
            } else {
                console.error("Frontend: News failed to load", res.error);
            }
        }
    };
    const loadAccounts = async () => {
        const accs = await window.electronAPI.getAccounts();
        setAccounts(accs || []);
    };

    const handleSwitch = async (uuid) => {
        const res = await window.electronAPI.switchAccount(uuid);
        if (res.success) {

            if (window.electronAPI.validateSession) {
                const val = await window.electronAPI.validateSession();
                if (val.success) {
                    const profile = await window.electronAPI.getProfile();
                    onProfileUpdate(profile);
                } else {

                    onProfileUpdate(null);
                }
            } else {
                onProfileUpdate(res.profile);
            }
            setShowSwitcher(false);
        }
    };

    const handleAddAccount = async () => {
        const res = await window.electronAPI.login();
        if (res.success) {
            onProfileUpdate(res.profile);
            setShowSwitcher(false);
        }
    };

    const handleRemove = async (e, uuid) => {
        e.stopPropagation();
        const res = await window.electronAPI.removeAccount(uuid);
        if (res.success) {
            if (res.loggedOut) {
                onProfileUpdate(null);
            } else {
                loadAccounts();
            }
        }
    };

    return (
        <div className="w-[250px] bg-transparent flex flex-col p-4 gap-4 relative backdrop-blur-sm">
            { }
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Account</span>
                    <div className="h-[1px] flex-1 bg-white/5 ml-3"></div>
                </div>

                <div className="relative">
                    <div
                        onClick={() => setShowSwitcher(!showSwitcher)}
                        className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-white/5 cursor-pointer hover:bg-white/5 transition-colors group"
                    >
                        <PlayerHead
                            src={liveSkin}
                            uuid={userProfile?.uuid}
                            name={userProfile?.name}
                            size={40}
                        />
                        <div className="overflow-hidden flex-1">
                            <div className="font-bold truncate text-white text-sm">{userProfile?.name}</div>
                            <div className="text-[10px] text-gray-500 truncate">{userProfile?.type || 'Online'}</div>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-500 transition-transform ${showSwitcher ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>

                    {showSwitcher && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d0d0d] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-150">
                            <div className="p-2 border-b border-white/5">
                                <span className="text-[10px] font-bold text-gray-500 px-2 uppercase tracking-widest">Switch Account</span>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                                {accounts.filter(a => a.uuid !== userProfile?.uuid).map(acc => (
                                    <div
                                        key={acc.uuid}
                                        onClick={() => handleSwitch(acc.uuid)}
                                        className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer group group"
                                    >
                                        <img
                                            src={`https://mc-heads.net/avatar/${acc.uuid || acc.name}/32`}
                                            alt={acc.name}
                                            className="w-8 h-8 rounded-md"
                                        />
                                        <span className="text-sm font-medium text-gray-300 group-hover:text-white truncate flex-1">{acc.name}</span>
                                        <button
                                            onClick={(e) => handleRemove(e, acc.uuid)}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={handleAddAccount}
                                    className="w-full flex items-center gap-3 p-3 text-primary hover:bg-primary/10 transition-colors border-t border-white/5"
                                >
                                    <div className="w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-bold">Add Account</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="my-2 border-t border-white/5 mx-1" />

            { }
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-1 mb-4">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Launcher News</span>
                    <div className="h-[1px] flex-1 bg-white/5 ml-3"></div>
                </div>

                <div className="flex-1 overflow-hidden pr-1">
                    {newsItems.length === 0 ? (
                        <div className="text-gray-500 text-xs text-center py-4">No news available</div>
                    ) : (
                        <AutoSizer>
                            {({ height, width }) => (
                                <FixedSizeList
                                    height={height}
                                    itemCount={newsItems.length}
                                    itemSize={160} // estimated height for title + image + desc
                                    width={width}
                                    className="custom-scrollbar"
                                >
                                    {({ index, style }) => {
                                        const item = newsItems[index];
                                        return (
                                            <div style={{ ...style, paddingRight: 4, paddingBottom: 16, boxSizing: 'border-box' }}>
                                                <div
                                                    className="group cursor-pointer"
                                                    onClick={() => item.link && window.electronAPI.openExternal(item.link)}
                                                >
                                                    <OptimizedImage 
                                                        src={item.image} 
                                                        alt={item.title} 
                                                        className="h-24 bg-surface rounded-xl border border-white/5 mb-2 overflow-hidden relative shadow-lg"
                                                        fallback={<div className="h-full w-full bg-gradient-to-br from-purple-900/20 to-blue-900/20"></div>}
                                                    />
                                                    <div className="text-sm font-bold text-gray-200 group-hover:text-primary transition-colors leading-tight truncate">{item.title}</div>
                                                    {item.description && <div className="text-[10px] text-gray-400 mt-1 line-clamp-2">{item.description}</div>}
                                                    <div className="text-[10px] text-gray-600 mt-1">{item.date}</div>
                                                </div>
                                            </div>
                                        );
                                    }}
                                </FixedSizeList>
                            )}
                        </AutoSizer>
                    )}
                </div>
            </div>
        </div>
    );
}

export default RightPanel;