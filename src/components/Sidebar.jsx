import React from 'react';

function Sidebar({ currentView, setView, onLogout }) {
    const menuItems = [
        { id: 'library', label: 'Library', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
        { id: 'search', label: 'Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
        { id: 'skins', label: 'Skins', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
        { id: 'styling', label: 'Styling', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
        { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
    ];

    return (
        <div className="w-16 my-4 ml-4 mr-2 bg-surface/10 rounded-2xl border border-white/5 shadow-2xl flex flex-col items-center py-6 gap-2 relative z-50"
            style={{ backdropFilter: 'blur(10px)' }}>
            {menuItems.map((item) => (
                <React.Fragment key={item.id}>
                    <button
                        onClick={() => setView(item.id)}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all group relative ${currentView === item.id
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {typeof item.icon === 'string' ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                            </svg>
                        ) : (
                            item.icon
                        )}

                        {/* Tooltip */}
                        <div className="absolute left-full ml-2 px-3 py-1.5 bg-[#0d0d0d] border border-white/10 rounded-lg text-xs font-bold text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 shadow-2xl">
                            {item.label}
                            <div className="absolute top-1/2 -left-1 transform -translate-y-1/2 border-4 border-transparent border-r-[#0d0d0d]"></div>
                        </div>
                    </button>
                    {(item.id === 'library' || item.id === 'styling') && (
                        <div className="w-8 h-[1px] bg-white/10 my-1"></div>
                    )}
                </React.Fragment>
            ))}

            <div className="flex-1"></div>

            <div className="w-8 h-[1px] bg-white/10 my-2"></div>

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
        </div>
    );
}

export default Sidebar;