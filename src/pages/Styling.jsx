import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';

const PRESETS = [
    { name: 'Emerald (Default)', primary: '#1bd96a', bg: '#111111', surface: '#1c1c1c' },
    { name: 'Ruby', primary: '#ff4d4d', bg: '#1a0505', surface: '#2d0a0a' },
    { name: 'Sapphire', primary: '#3498db', bg: '#05111a', surface: '#0a1d2d' },
    { name: 'Amethyst', primary: '#a29bfe', bg: '#130f1d', surface: '#1e1633' },
    { name: 'Ocean', primary: '#00d2ff', bg: '#000c14', surface: '#001a2c' },
    { name: 'Sunset', primary: '#ff7e5f', bg: '#140800', surface: '#2c1200' },
];

function Styling() {
    const { addNotification } = useNotification();
    const [theme, setTheme] = useState({
        primaryColor: '#1bd96a',
        backgroundColor: '#111111',
        surfaceColor: '#1c1c1c',
        glassBlur: 10,
        glassOpacity: 0.8,
        consoleOpacity: 0.8,
        borderRadius: 12,
        bgMedia: { url: '', type: 'none' }
    });

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        const res = await window.electronAPI.getSettings();
        if (res.success && res.settings.theme) {
            setTheme(prev => ({ ...prev, ...res.settings.theme }));
            applyTheme(res.settings.theme);
        }
    };

    const applyTheme = (t) => {
        const root = document.documentElement;
        root.style.setProperty('--primary-color', t.primaryColor);
        root.style.setProperty('--background-color', t.backgroundColor);
        root.style.setProperty('--surface-color', t.surfaceColor);
        root.style.setProperty('--glass-blur', `${t.glassBlur}px`);
        root.style.setProperty('--glass-opacity', t.glassOpacity);
        root.style.setProperty('--console-opacity', t.consoleOpacity || 0.8);
        root.style.setProperty('--border-radius', `${t.borderRadius || 12}px`);

        // Helper to adjust colors
        const adjustColor = (hex, pct) => {
            const n = parseInt(hex.replace('#', ''), 16);
            const a = Math.round(2.55 * pct);
            const R = (n >> 16) + a;
            const G = (n >> 8 & 0x00FF) + a;
            const B = (n & 0x0000FF) + a;
            return '#' + (0x1000000 + (R < 255 ? R < 0 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 0 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 0 ? 0 : B : 255)).toString(16).slice(1);
        };

        root.style.setProperty('--primary-hover-color', adjustColor(t.primaryColor, 15));
        root.style.setProperty('--background-dark-color', adjustColor(t.backgroundColor, -20));

        // RGB for glass visibility
        const hexToRgb = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `${r}, ${g}, ${b}`;
        };
        root.style.setProperty('--surface-color-rgb', hexToRgb(t.surfaceColor));
        root.style.setProperty('--primary-color-rgb', hexToRgb(t.primaryColor));
        root.style.setProperty('--background-dark-color-rgb', hexToRgb(adjustColor(t.backgroundColor, -20)));

        if (t.bgMedia && t.bgMedia.url) {
            root.style.setProperty('--bg-url', t.bgMedia.url);
            root.style.setProperty('--bg-type', t.bgMedia.type);
        } else {
            root.style.setProperty('--bg-url', '');
            root.style.setProperty('--bg-type', 'none');
        }
    };

    const handleUpdate = (key, value) => {
        const newTheme = { ...theme, [key]: value };
        setTheme(newTheme);
        applyTheme(newTheme);
    };

    const handleSelectBackground = async () => {
        const res = await window.electronAPI.selectBackgroundMedia();
        if (res.success && res.url) {
            console.log('Selected background:', res.url);
            handleUpdate('bgMedia', { url: res.url, type: res.type });
        } else if (res.error) {
            console.error('Failed to select background:', res.error);
        }
    };

    const handleSave = async () => {
        const res = await window.electronAPI.getSettings();
        if (res.success) {
            const newSettings = { ...res.settings, theme };
            const saveRes = await window.electronAPI.saveSettings(newSettings);
            if (saveRes.success) {
                addNotification('Styling preferences saved!', 'success');
            }
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-12">
            <header className="mb-8">
                <h1 className="text-4xl font-black text-white tracking-tight">Launcher Customization</h1>
                <p className="text-gray-400 mt-2">Design your workspace exactly how you want it.</p>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left: Basic Colors & Presets */}
                <div className="xl:col-span-1 space-y-8">
                    <section className="bg-surface/50 backdrop-blur-md p-6 rounded-2xl border border-white/5">
                        <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-6">Accent & Base</h2>
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-gray-300">Accent Color</label>
                                <input
                                    type="color"
                                    value={theme.primaryColor}
                                    onChange={(e) => handleUpdate('primaryColor', e.target.value)}
                                    className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-gray-300">Background</label>
                                <input
                                    type="color"
                                    value={theme.backgroundColor}
                                    onChange={(e) => handleUpdate('backgroundColor', e.target.value)}
                                    className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-gray-300">Panels</label>
                                <input
                                    type="color"
                                    value={theme.surfaceColor}
                                    onChange={(e) => handleUpdate('surfaceColor', e.target.value)}
                                    className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="bg-surface/50 backdrop-blur-md p-6 rounded-2xl border border-white/5">
                        <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Quick Themes</h2>
                        <div className="grid grid-cols-1 gap-2">
                            {PRESETS.map((p) => (
                                <button
                                    key={p.name}
                                    onClick={() => {
                                        const nt = { ...theme, primaryColor: p.primary, backgroundColor: p.bg, surfaceColor: p.surface };
                                        setTheme(nt);
                                        applyTheme(nt);
                                    }}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
                                >
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.primary }} />
                                    <span className="text-xs font-bold text-gray-400 group-hover:text-white">{p.name}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Right: Advanced Effects & Background */}
                <div className="xl:col-span-2 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <section className="bg-surface/50 backdrop-blur-md p-6 rounded-2xl border border-white/5 flex flex-col justify-between">
                            <div>
                                <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-6">Interactive Effects</h2>
                                <div className="space-y-8">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-bold text-gray-300">Corner Roundness</label>
                                            <span className="text-[10px] font-mono text-primary">{theme.borderRadius || 12}px</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="32" step="2"
                                            value={theme.borderRadius || 12}
                                            onChange={(e) => handleUpdate('borderRadius', parseInt(e.target.value))}
                                            className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-bold text-gray-300">Glass Blur</label>
                                            <span className="text-[10px] font-mono text-primary">{theme.glassBlur}px</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="40" step="1"
                                            value={theme.glassBlur}
                                            onChange={(e) => handleUpdate('glassBlur', parseInt(e.target.value))}
                                            className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-bold text-gray-300">Console Opacity</label>
                                            <span className="text-[10px] font-mono text-primary">{Math.round((theme.consoleOpacity || 0.8) * 100)}%</span>
                                        </div>
                                        <input
                                            type="range" min="0.1" max="1" step="0.05"
                                            value={theme.consoleOpacity || 0.8}
                                            onChange={(e) => handleUpdate('consoleOpacity', parseFloat(e.target.value))}
                                            className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary"
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="bg-surface/50 backdrop-blur-md p-6 rounded-2xl border border-white/5">
                            <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-6">Atmosphere</h2>
                            <div className="space-y-6">
                                <div
                                    onClick={handleSelectBackground}
                                    className="aspect-video rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-white/5 hover:border-primary/50 transition-all group overflow-hidden relative"
                                >
                                    {theme.bgMedia?.url ? (
                                        <>
                                            {theme.bgMedia.type === 'video' ? (
                                                <video src={`app-media:///${theme.bgMedia.url.replace(/\\/g, '/')}`} className="absolute inset-0 w-full h-full object-cover opacity-40" autoPlay loop muted />
                                            ) : (
                                                <img
                                                    key={theme.bgMedia.url}
                                                    src={`app-media:///${theme.bgMedia.url.replace(/\\/g, '/')}`}
                                                    className="absolute inset-0 w-full h-full object-cover opacity-40"
                                                    alt=""
                                                />
                                            )}
                                            <div className="relative z-10 text-center">
                                                <div className="text-[10px] font-black uppercase text-white tracking-widest bg-black/50 px-3 py-1 rounded-full border border-white/20">Change Background</div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-600 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <div className="text-[10px] font-black text-gray-500 uppercase">Select Image/GIF/Video</div>
                                        </>
                                    )}
                                </div>
                                {theme.bgMedia?.url && (
                                    <button
                                        onClick={async () => {
                                            if (theme.bgMedia.url) {
                                                // Try to delete the file physically if it's a local file
                                                await window.electronAPI.deleteBackgroundMedia(theme.bgMedia.url);
                                            }
                                            handleUpdate('bgMedia', { url: '', type: 'none' });
                                        }}
                                        className="text-[10px] font-bold text-red-500 hover:text-red-400 flex items-center gap-1 mx-auto"
                                    >
                                        Remove Background
                                    </button>
                                )}
                            </div>
                        </section>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={loadTheme}
                            className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white px-8 py-3 rounded-xl font-bold transition-all text-sm"
                        >
                            Reset
                        </button>
                        <button
                            onClick={handleSave}
                            className="bg-primary hover:scale-[1.02] active:scale-95 text-black px-12 py-3 rounded-xl font-black shadow-2xl shadow-primary/30 transition-all text-sm"
                        >
                            Save Theme
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Styling;
