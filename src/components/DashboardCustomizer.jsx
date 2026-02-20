import React from 'react';

function DashboardCustomizer({ settings, onUpdate, onClose, onEnterEditor }) {
    const handleChange = (key, value) => {
        onUpdate({
            ...settings,
            [key]: value
        });
    };

    const toggleSection = (id) => {
        const newLayout = (settings.layout || []).map(section => {
            if (section.id === id) {
                return { ...section, visible: !section.visible };
            }
            return section;
        });
        handleChange('layout', newLayout);
    };

    const isVisible = (id) => {
        return settings.layout?.find(s => s.id === id)?.visible !== false;
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-surface/50">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Customize Dashboard
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                    { }
                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-black">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">Visual Layout Editor</h3>
                                <p className="text-[10px] text-gray-400">Rearrange and resize your dashboard</p>
                            </div>
                        </div>
                        <button
                            onClick={onEnterEditor}
                            className="bg-primary hover:bg-primary-hover text-black text-xs font-bold py-2 rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                        >
                            Open Visual Editor
                        </button>
                    </div>

                    { }
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Welcome Message</label>
                        <input
                            type="text"
                            value={settings.welcomeMessage || 'Welcome back!'}
                            onChange={(e) => handleChange('welcomeMessage', e.target.value)}
                            placeholder="Welcome back!"
                            className="w-full bg-background-dark border border-white/10 rounded-xl p-3 text-white focus:border-primary outline-none transition-all shadow-inner"
                        />
                    </div>

                    { }
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Toggle Sections</label>

                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-white/10 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                </div>
                                <span className="text-sm font-medium text-gray-200">Jump back in</span>
                            </div>
                            <button
                                onClick={() => toggleSection('recent-instances')}
                                className={`w-10 h-5 rounded-full transition-all relative ${isVisible('recent-instances') ? 'bg-primary' : 'bg-gray-700'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isVisible('recent-instances') ? 'right-1' : 'left-1'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-white/10 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                                </div>
                                <span className="text-sm font-medium text-gray-200">Recent Worlds</span>
                            </div>
                            <button
                                onClick={() => toggleSection('recent-worlds')}
                                className={`w-10 h-5 rounded-full transition-all relative ${isVisible('recent-worlds') ? 'bg-primary' : 'bg-gray-700'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isVisible('recent-worlds') ? 'right-1' : 'left-1'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-white/10 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                </div>
                                <span className="text-sm font-medium text-gray-200">Discover Modpacks</span>
                            </div>
                            <button
                                onClick={() => toggleSection('modpacks')}
                                className={`w-10 h-5 rounded-full transition-all relative ${isVisible('modpacks') ? 'bg-primary' : 'bg-gray-700'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isVisible('modpacks') ? 'right-1' : 'left-1'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-white/10 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                                </div>
                                <span className="text-sm font-medium text-gray-200">Mod of the Day</span>
                            </div>
                            <button
                                onClick={() => toggleSection('mod-of-the-day')}
                                className={`w-10 h-5 rounded-full transition-all relative ${isVisible('mod-of-the-day') ? 'bg-primary' : 'bg-gray-700'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isVisible('mod-of-the-day') ? 'right-1' : 'left-1'}`} />
                            </button>
                        </div>


                    </div>
                </div>

                <div className="p-6 border-t border-white/5 bg-surface/30 flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-primary text-black font-bold px-8 py-2.5 rounded-xl hover:bg-primary-hover hover:scale-105 transition-all shadow-lg shadow-primary/20"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DashboardCustomizer;