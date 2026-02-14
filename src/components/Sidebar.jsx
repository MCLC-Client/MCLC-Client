import React from 'react';

function Sidebar({ currentView, setView, onLogout }) {
    const navItems = [
        { id: 'dashboard', label: 'Library', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>, category: 'main' },
        { id: 'search', label: 'Search', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>, category: 'content' },
        { id: 'skins', label: 'Skins', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>, category: 'content' },
        { id: 'styling', label: 'Styling', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>, category: 'content' },
        { id: 'settings', label: 'Settings', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>, category: 'system' },
    ];

    const renderButton = (item) => (
        <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full aspect-square flex items-center justify-center rounded-xl transition-all group relative ${currentView === item.id
                ? 'bg-primary text-black shadow-primary-glow'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
            title={item.label}
        >
            {item.icon}
        </button>
    );

    return (
        <div className="w-[72px] h-full bg-surface/10 flex flex-col items-center py-6 border-r border-white/5 z-20 backdrop-blur-md">
            <nav className="flex-1 flex flex-col gap-2 w-full px-3">
                {/* Main Section */}
                {navItems.filter(i => i.category === 'main').map(renderButton)}

                <div className="my-4 border-t border-white/5 mx-2" />

                {/* Content Section */}
                <div className="flex flex-col gap-4">
                    {navItems.filter(i => i.category === 'content').map(renderButton)}
                </div>

                <div className="my-4 border-t border-white/5 mx-2" />

                {/* System Section */}
                {navItems.filter(i => i.category === 'system').map(renderButton)}
            </nav>

            <div className="mt-auto px-3 w-full pt-4 border-t border-white/5">
                <button
                    onClick={onLogout}
                    className="w-full aspect-square flex items-center justify-center rounded-xl text-gray-500 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    title="Logout"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

export default Sidebar;
