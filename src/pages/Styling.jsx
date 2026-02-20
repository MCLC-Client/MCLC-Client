import React, { useState, useEffect } from "react";
import { useNotification } from "../context/NotificationContext";
import ColorPicker from "../components/ColorPicker";
import SliderControl from "../components/SliderControl";
import ThemeCard from "../components/ThemeCard";
import MiniPreview from "../components/MiniPreview";

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

  useEffect(() => {
    loadTheme();
    loadCustomPresets();

    return () => {
      // Revert to saved theme if not saved
      window.electronAPI.getSettings().then(res => {
        if (res.success && res.settings.theme) {
          const t = res.settings.theme;
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
            if (!hex || typeof hex !== 'string') return '28, 28, 28';
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
        }
      });
    };
  }, []);

  const loadCustomPresets = async () => {
    const res = await window.electronAPI.getCustomPresets();
    if (res.success) setCustomPresets(res.presets);
  };

  const handleDeletePreset = async (handle) => {
    const res = await window.electronAPI.deleteCustomPreset(handle);
    if (res.success) {
      addNotification("Preset deleted", "success");
      loadCustomPresets();
    }
  };

  const handleExportTheme = async () => {
    const presetData = {
      handle: theme.name ? theme.name.toLowerCase().replace(/[^a-z0-9_-]/g, '') : 'custom_theme',
      name: theme.name || "Custom Theme",
      primary: theme.primaryColor,
      bg: theme.backgroundColor,
      surface: theme.surfaceColor,
      sidebarGlow: theme.sidebarGlow,
      panelOpacity: theme.panelOpacity,
      bgOverlay: theme.bgOverlay,
    };

    const res = await window.electronAPI.exportCustomPreset(presetData);
    if (res.success) {
      addNotification(`Theme exported to ${res.path}`, "success");
    } else if (res.error !== 'Cancelled') {
      addNotification(`Export failed: ${res.error}`, "error");
    }
  };

  const handleImportTheme = async () => {
    const res = await window.electronAPI.importCustomPreset();
    if (res.success) {
      addNotification("Theme imported successfully!", "success");
      loadCustomPresets();
    } else if (res.error !== 'Cancelled') {
      addNotification(`Import failed: ${res.error}`, "error");
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
      handleUpdate("bgMedia", { url: res.url, type: res.type });
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
    <div className="p-10 text-white h-full overflow-y-auto custom-scrollbar">
      {/* Hero Section */}
      <header className="mb-10">
        <h1 className="text-4xl font-black text-white tracking-tight mb-2">
          Launcher Customization
        </h1>
        <p className="text-gray-400">
          Design your workspace exactly how you want it.
        </p>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl">

        {/* Left Column - Colors & Themes */}
        <div className="lg:col-span-3 space-y-6">
          {/* Accent & Base Colors */}
          <section className="bg-surface/50 backdrop-blur-md p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-6">
              Accent & Base
            </h2>
            <div className="space-y-5">
              <ColorPicker
                label="Accent Color"
                value={theme.primaryColor}
                onChange={(val) => handleUpdate("primaryColor", val)}
              />
              <ColorPicker
                label="Background"
                value={theme.backgroundColor}
                onChange={(val) => handleUpdate("backgroundColor", val)}
              />
              <ColorPicker
                label="Panels"
                value={theme.surfaceColor}
                onChange={(val) => handleUpdate("surfaceColor", val)}
              />
            </div>
          </section>

          {/* Quick Themes */}
          <section className="bg-surface/50 backdrop-blur-md p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">
                Quick Themes
              </h2>
              <button
                onClick={handleImportTheme}
                className="text-[10px] font-bold text-primary uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Import
              </button>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {/* Custom Presets */}
              {customPresets.length > 0 && (
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-gray-600 uppercase">Custom</span>
                  <div className="grid grid-cols-1 gap-2">
                    {customPresets.map((p) => (
                      <ThemeCard
                        key={p.handle}
                        theme={p}
                        onApply={() => applyPreset(p)}
                        onDelete={() => handleDeletePreset(p.handle)}
                        isCustom={true}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Built-in Presets */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-gray-600 uppercase">Presets</span>
                <div className="grid grid-cols-1 gap-2">
                  {PRESETS.map((p) => (
                    <ThemeCard
                      key={p.name}
                      theme={p}
                      onApply={() => applyPreset(p)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Center & Right Columns */}
        <div className="lg:col-span-9 space-y-6">
          {/* Live Preview */}
          <section className="bg-surface/50 backdrop-blur-md p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-6">
              Live Preview
            </h2>
            <MiniPreview theme={theme} />
          </section>

          {/* Effects & Atmosphere Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Interactive Effects */}
            <section className="bg-surface/50 backdrop-blur-md p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
              <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-6">
                Interactive Effects
              </h2>
              <div className="space-y-5">
                <SliderControl
                  label="Corner Roundness"
                  value={theme.borderRadius || 12}
                  min={0}
                  max={32}
                  step={2}
                  unit="px"
                  onChange={(val) => handleUpdate("borderRadius", val)}
                />
                <SliderControl
                  label="Glass Blur"
                  value={theme.glassBlur}
                  min={0}
                  max={40}
                  step={1}
                  unit="px"
                  onChange={(val) => handleUpdate("glassBlur", val)}
                />
                <SliderControl
                  label="Sidebar Glow"
                  value={Math.round((theme.sidebarGlow || 0.3) * 100)}
                  min={0}
                  max={100}
                  step={5}
                  unit="%"
                  onChange={(val) => handleUpdate("sidebarGlow", val / 100)}
                />
                <SliderControl
                  label="Panel Opacity"
                  value={Math.round((theme.panelOpacity || 0.85) * 100)}
                  min={10}
                  max={100}
                  step={5}
                  unit="%"
                  onChange={(val) => handleUpdate("panelOpacity", val / 100)}
                />
                <SliderControl
                  label="Console Opacity"
                  value={Math.round((theme.consoleOpacity || 0.8) * 100)}
                  min={10}
                  max={100}
                  step={5}
                  unit="%"
                  onChange={(val) => handleUpdate("consoleOpacity", val / 100)}
                />
              </div>
            </section>

            {/* Atmosphere */}
            <section className="bg-surface/50 backdrop-blur-md p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
              <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-6">
                Atmosphere
              </h2>
              <div className="space-y-5">
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
                    <SliderControl
                      label="Overlay Intensity"
                      value={Math.round((theme.bgOverlay || 0.4) * 100)}
                      min={0}
                      max={100}
                      step={5}
                      unit="%"
                      onChange={(val) => handleUpdate("bgOverlay", val / 100)}
                    />
                    <button
                      onClick={async () => {
                        if (theme.bgMedia.url) {
                          await window.electronAPI.deleteBackgroundMedia(theme.bgMedia.url);
                        }
                        handleUpdate("bgMedia", { url: "", type: "none" });
                      }}
                      className="text-xs font-bold text-red-500 hover:text-red-400 flex items-center gap-2 mx-auto transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Remove Background
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={loadTheme}
              className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white px-6 py-3 rounded-xl font-bold transition-all text-sm border border-white/5 hover:border-white/10"
            >
              Reset
            </button>
            <button
              onClick={handleExportTheme}
              className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white px-6 py-3 rounded-xl font-bold transition-all text-sm border border-white/5 hover:border-white/10 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Export Theme
            </button>
            <button
              onClick={handleSave}
              className="bg-primary hover:bg-primary-hover text-black px-8 py-3 rounded-xl font-black shadow-lg shadow-primary/30 transition-all text-sm hover:scale-[1.02] active:scale-95"
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