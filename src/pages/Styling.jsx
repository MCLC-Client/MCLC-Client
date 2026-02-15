import React, { useState, useEffect } from "react";
import { useNotification } from "../context/NotificationContext";

const PRESETS = [
  {
    name: "Emerald (Default)",
    primary: "#22e07a",
    bg: "#0d1117",
    surface: "#161b22",
  },
  {
    name: "Ruby",
    primary: "#ff5c6c",
    bg: "#140a0c",
    surface: "#1f1114",
  },
  {
    name: "Sapphire",
    primary: "#3da9fc",
    bg: "#0b1220",
    surface: "#121a2b",
  },
  {
    name: "Amethyst",
    primary: "#b388ff",
    bg: "#14121c",
    surface: "#1c1826",
  },
  {
    name: "Ocean",
    primary: "#00e0c6",
    bg: "#071418",
    surface: "#0f1f24",
  },
  {
    name: "Sunset",
    primary: "#ff8a5b",
    bg: "#1a0f0a",
    surface: "#241611",
  },
  {
    name: "Cyberpunk",
    primary: "#f3e600",
    bg: "#1a0033",
    surface: "#2d004d",
  },
  {
    name: "Frost",
    primary: "#a5f3fc",
    bg: "#0f172a",
    surface: "#1e293b",
  },
  {
    name: "Autumn",
    primary: "#fb923c",
    bg: "#1c1917",
    surface: "#292524",
  },
  {
    name: "Midnight",
    primary: "#3b82f6",
    bg: "#000000",
    surface: "#111111",
  },
  {
    name: "Candy",
    primary: "#f472b6",
    bg: "#1e1b4b",
    surface: "#312e81",
  },
  {
    name: "Gold",
    primary: "#fbbf24",
    bg: "#171717",
    surface: "#262626",
  },
];

function Styling() {
  const { addNotification } = useNotification();
  const [theme, setTheme] = useState({
    primaryColor: "#1bd96a",
    backgroundColor: "#111111",
    surfaceColor: "#1c1c1c",
    glassBlur: 10,
    glassOpacity: 0.8,
    consoleOpacity: 0.8,
    borderRadius: 12,
    bgMedia: { url: "", type: "none" },
    sidebarGlow: 0.3,
    panelOpacity: 0.85,
    bgOverlay: 0.4,
  });

  const [customPresets, setCustomPresets] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPreset, setNewPreset] = useState({ name: "", handle: "" });
  const [settings, setSettings] = useState({ showDisabledFeatures: false });

  useEffect(() => {
    loadTheme();
    loadCustomPresets();
  }, []);

  const loadCustomPresets = async () => {
    const res = await window.electronAPI.getCustomPresets();
    if (res.success) setCustomPresets(res.presets);
  };

  const handleSavePreset = async () => {
    if (!newPreset.name || !newPreset.handle) return;
    const presetData = {
      handle: newPreset.handle,
      name: newPreset.name,
      primary: theme.primaryColor,
      bg: theme.backgroundColor,
      surface: theme.surfaceColor,
      sidebarGlow: theme.sidebarGlow,
      panelOpacity: theme.panelOpacity,
      bgOverlay: theme.bgOverlay,
    };
    const res = await window.electronAPI.saveCustomPreset(presetData);
    if (res.success) {
      addNotification(`Preset "${newPreset.name}" saved!`, "success");
      setShowSaveModal(false);
      setNewPreset({ name: "", handle: "" });
      loadCustomPresets();
    }
  };

  const handleDeletePreset = async (e, handle) => {
    e.stopPropagation();
    const res = await window.electronAPI.deleteCustomPreset(handle);
    if (res.success) {
      addNotification("Preset deleted", "success");
      loadCustomPresets();
    }
  };

  const applyPreset = (p) => {
    const nt = {
      ...theme,
      primaryColor: p.primary,
      backgroundColor: p.bg,
      surfaceColor: p.surface,
      sidebarGlow: p.sidebarGlow || theme.sidebarGlow,
      panelOpacity: p.panelOpacity || theme.panelOpacity,
      bgOverlay: p.bgOverlay || theme.bgOverlay,
    };
    setTheme(nt);
    applyTheme(nt);
  };

  const loadTheme = async () => {
    const res = await window.electronAPI.getSettings();
    if (res.success) {
      if (res.settings.theme) {
        setTheme((prev) => ({ ...prev, ...res.settings.theme }));
        applyTheme(res.settings.theme);
      }
      setSettings(res.settings);
    }
  };

  const applyTheme = (t) => {
    const root = document.documentElement;
    root.style.setProperty("--primary-color", t.primaryColor);
    root.style.setProperty("--background-color", t.backgroundColor);
    root.style.setProperty("--surface-color", t.surfaceColor);
    root.style.setProperty("--glass-blur", `${t.glassBlur}px`);
    root.style.setProperty("--glass-opacity", t.glassOpacity);
    root.style.setProperty("--console-opacity", t.consoleOpacity || 0.8);
    root.style.setProperty("--border-radius", `${t.borderRadius || 12}px`);
    root.style.setProperty("--sidebar-glow-intensity", t.sidebarGlow || 0.3);
    root.style.setProperty("--panel-opacity", t.panelOpacity || 0.85);
    root.style.setProperty("--bg-overlay-opacity", t.bgOverlay || 0.4);
    const adjustColor = (hex, pct) => {
      const n = parseInt(hex.replace("#", ""), 16);
      const a = Math.round(2.55 * pct);
      const R = (n >> 16) + a;
      const G = ((n >> 8) & 0x00ff) + a;
      const B = (n & 0x0000ff) + a;
      return (
        "#" +
        (
          0x1000000 +
          (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
          (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
          (B < 255 ? (B < 0 ? 0 : B) : 255)
        )
          .toString(16)
          .slice(1)
      );
    };

    root.style.setProperty(
      "--primary-hover-color",
      adjustColor(t.primaryColor, 15),
    );
    root.style.setProperty(
      "--background-dark-color",
      adjustColor(t.backgroundColor, -20),
    );
    const hexToRgb = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `${r}, ${g}, ${b}`;
    };
    root.style.setProperty("--surface-color-rgb", hexToRgb(t.surfaceColor));
    root.style.setProperty("--primary-color-rgb", hexToRgb(t.primaryColor));
    root.style.setProperty(
      "--background-dark-color-rgb",
      hexToRgb(adjustColor(t.backgroundColor, -20)),
    );

    if (t.bgMedia && t.bgMedia.url) {
      root.style.setProperty("--bg-url", t.bgMedia.url);
      root.style.setProperty("--bg-type", t.bgMedia.type);
    } else {
      root.style.setProperty("--bg-url", "");
      root.style.setProperty("--bg-type", "none");
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
      console.log("Selected background:", res.url);
      handleUpdate("bgMedia", { url: res.url, type: res.type });
    } else if (res.error) {
      console.error("Failed to select background:", res.error);
    }
  };

  const handleSave = async () => {
    const res = await window.electronAPI.getSettings();
    if (res.success) {
      const newSettings = { ...res.settings, theme };
      const saveRes = await window.electronAPI.saveSettings(newSettings);
      if (saveRes.success) {
        addNotification("Styling preferences saved!", "success");
      }
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12">
      <header className="mb-8">
        <h1 className="text-4xl font-black text-white tracking-tight">
          Launcher Customization
        </h1>
        <p className="text-gray-400 mt-2">
          Design your workspace exactly how you want it.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        { }
        <div className="xl:col-span-1 space-y-8">
          <section className="bg-surface/50 backdrop-blur-md p-6 rounded-2xl border border-white/5">
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-6">
              Accent & Base
            </h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-300">
                  Accent Color
                </label>
                <input
                  type="color"
                  value={theme.primaryColor}
                  onChange={(e) => handleUpdate("primaryColor", e.target.value)}
                  className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-300">
                  Background
                </label>
                <input
                  type="color"
                  value={theme.backgroundColor}
                  onChange={(e) =>
                    handleUpdate("backgroundColor", e.target.value)
                  }
                  className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-300">
                  Panels
                </label>
                <input
                  type="color"
                  value={theme.surfaceColor}
                  onChange={(e) => handleUpdate("surfaceColor", e.target.value)}
                  className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer"
                />
              </div>
            </div>
          </section>

          <section className="bg-surface/50 backdrop-blur-md p-6 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">
                Quick Themes
              </h2>
              {settings.showDisabledFeatures ? (
                <button
                  disabled
                  className="text-[10px] font-bold text-gray-500 uppercase tracking-widest opacity-50 cursor-not-allowed"
                  title="This feature is coming soon"
                >
                  Save Custom
                </button>
              ) : null}
            </div>
            
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {customPresets.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-600 uppercase">Custom</span>
                  <div className="grid grid-cols-1 gap-2">
                    {customPresets.map((p) => (
                      <button
                        key={p.handle}
                        onClick={() => applyPreset(p)}
                        className="flex items-center justify-between p-3 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/10 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                            style={{ backgroundColor: p.primary }}
                          />
                          <span className="text-xs font-bold text-primary group-hover:text-white">
                            {p.name}
                          </span>
                        </div>
                        <div
                          onClick={(e) => handleDeletePreset(e, p.handle)}
                          className="p-1 hover:bg-red-500/20 rounded-md text-gray-500 hover:text-red-500 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-600 uppercase">Presets</span>
                <div className="grid grid-cols-1 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => applyPreset(p)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: p.primary }}
                      />
                      <span className="text-xs font-bold text-gray-400 group-hover:text-white">
                        {p.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        { }
        <div className="xl:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="bg-surface/50 backdrop-blur-md p-6 rounded-2xl border border-white/5 flex flex-col justify-between">
              <div>
                <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-6">
                  Interactive Effects
                </h2>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-bold text-gray-300">
                        Corner Roundness
                      </label>
                      <span className="text-[10px] font-mono text-primary">
                        {theme.borderRadius || 12}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="32"
                      step="2"
                      value={theme.borderRadius || 12}
                      onChange={(e) =>
                        handleUpdate("borderRadius", parseInt(e.target.value))
                      }
                      className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-bold text-gray-300">
                        Glass Blur
                      </label>
                      <span className="text-[10px] font-mono text-primary">
                        {theme.glassBlur}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      step="1"
                      value={theme.glassBlur}
                      onChange={(e) =>
                        handleUpdate("glassBlur", parseInt(e.target.value))
                      }
                      className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-bold text-gray-300">
                        Sidebar Glow
                      </label>
                      <span className="text-[10px] font-mono text-primary">
                        {Math.round((theme.sidebarGlow || 0.3) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={theme.sidebarGlow || 0.3}
                      onChange={(e) =>
                        handleUpdate("sidebarGlow", parseFloat(e.target.value))
                      }
                      className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-bold text-gray-300">
                        Panel Opacity
                      </label>
                      <span className="text-[10px] font-mono text-primary">
                        {Math.round((theme.panelOpacity || 0.85) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={theme.panelOpacity || 0.85}
                      onChange={(e) =>
                        handleUpdate("panelOpacity", parseFloat(e.target.value))
                      }
                      className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-bold text-gray-300">
                        Console Opacity
                      </label>
                      <span className="text-[10px] font-mono text-primary">
                        {Math.round((theme.consoleOpacity || 0.8) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={theme.consoleOpacity || 0.8}
                      onChange={(e) =>
                        handleUpdate(
                          "consoleOpacity",
                          parseFloat(e.target.value),
                        )
                      }
                      className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-surface/50 backdrop-blur-md p-6 rounded-2xl border border-white/5">
              <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-6">
                Atmosphere
              </h2>
              <div className="space-y-6">
                <div
                  onClick={handleSelectBackground}
                  className="aspect-video rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-white/5 hover:border-primary/50 transition-all group overflow-hidden relative"
                >
                  {theme.bgMedia?.url ? (
                    <>
                      {theme.bgMedia.type === "video" ? (
                        <video
                          src={`app-media:///${theme.bgMedia.url.replace(/\\/g, "/")}`}
                          className="absolute inset-0 w-full h-full object-cover opacity-40"
                          autoPlay
                          loop
                          muted
                        />
                      ) : (
                        <img
                          key={theme.bgMedia.url}
                          src={`app-media:///${theme.bgMedia.url.replace(/\\/g, "/")}`}
                          className="absolute inset-0 w-full h-full object-cover opacity-40"
                          alt=""
                        />
                      )}
                      <div className="relative z-10 text-center">
                        <div className="text-[10px] font-black uppercase text-white tracking-widest bg-black/50 px-3 py-1 rounded-full border border-white/20">
                          Change Background
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-8 w-8 text-gray-600 group-hover:text-primary transition-colors"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <div className="text-[10px] font-black text-gray-500 uppercase">
                        Select Image/GIF/Video
                      </div>
                    </>
                  )}
                </div>
                
                {theme.bgMedia?.url && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-gray-300">
                          Overlay Intensity
                        </label>
                        <span className="text-[10px] font-mono text-primary">
                          {Math.round((theme.bgOverlay || 0.4) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={theme.bgOverlay || 0.4}
                        onChange={(e) =>
                          handleUpdate("bgOverlay", parseFloat(e.target.value))
                        }
                        className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (theme.bgMedia.url) {
                          await window.electronAPI.deleteBackgroundMedia(theme.bgMedia.url);
                        }
                        handleUpdate("bgMedia", { url: "", type: "none" });
                      }}
                      className="text-[10px] font-bold text-red-500 hover:text-red-400 flex items-center gap-1 mx-auto"
                    >
                      Remove Background
                    </button>
                  </div>
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
            {settings.showDisabledFeatures ? (
              <button
                disabled
                className="bg-white/5 text-gray-500 px-8 py-3 rounded-xl font-bold transition-all text-sm border border-white/10 cursor-not-allowed opacity-50"
                title="This feature is coming soon"
              >
                Export Theme
              </button>
            ) : null}
            <button
              onClick={handleSave}
              className="bg-primary hover:scale-[1.02] active:scale-95 text-black px-12 py-3 rounded-xl font-black shadow-2xl shadow-primary/30 transition-all text-sm"
            >
              Save Theme
            </button>
          </div>
        </div>
      </div>

      {/* Save Preset Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-black text-white mb-6 uppercase tracking-wider">Save Custom Preset</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. My Awesome Theme"
                  value={newPreset.name}
                  onChange={(e) => setNewPreset({ ...newPreset, name: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Handle (Filename)</label>
                <input
                  type="text"
                  placeholder="e.g. awesome-theme"
                  value={newPreset.handle}
                  onChange={(e) => setNewPreset({ ...newPreset, handle: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreset}
                disabled={!newPreset.name || !newPreset.handle}
                className="flex-1 px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-black font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Styling;