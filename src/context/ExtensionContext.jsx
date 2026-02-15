import React, { createContext, useContext, useState, useEffect } from 'react';

// Simple ID generator to avoid nanoid dependency issues
const generateId = () => Math.random().toString(36).substr(2, 9);

const ExtensionContext = createContext();

// GLOBAL KILL SWITCH - Set to false to disable all extension features
const EXTENSIONS_ENABLED = false;

export const useExtensions = () => useContext(ExtensionContext);

export const ExtensionProvider = ({ children }) => {
    const [installedExtensions, setInstalledExtensions] = useState([]);
    const [views, setViews] = useState({}); // { "sidebar.bottom": [ { id, component } ] }
    const [loading, setLoading] = useState(true);

    // API exposed to extensions
    const createExtensionApi = (extensionId) => ({
        registerView: (slotName, component) => {
            setViews(prev => {
                const slotViews = prev[slotName] || [];
                // Avoid duplicates if HMR triggers re-registration
                if (slotViews.some(v => v.extensionId === extensionId && v.component === component)) {
                    return prev;
                }
                return {
                    ...prev,
                    [slotName]: [...slotViews, { id: generateId(), extensionId, component }]
                };
            });
        },
        // We can add more capabilities here (e.g. notifications, dialogs)
    });

    // Load a single extension (sandboxed execution)
    const loadExtension = async (ext) => {
        try {
            const entryPath = ext.localPath + '/' + (ext.main || 'index.js');
            const importUrl = `app-media:///${entryPath}`;
            
            // Fetch and evaluate
            const response = await fetch(importUrl);
            if (!response.ok) throw new Error(`Failed to fetch ${entryPath}`);
            const code = await response.text();

            const customRequire = (moduleName) => {
                if (moduleName === 'react') return window.React;
                if (moduleName === 'react-dom') return window.ReactDOM;
                if (moduleName === 'react-dom/client') return window.ReactDOM;
                throw new Error(`Cannot find module '${moduleName}'`);
            };

            const exports = {};
            const module = { exports };
            const api = createExtensionApi(ext.id);

            const wrapper = new Function('require', 'exports', 'module', 'React', 'api', code);
            wrapper(customRequire, exports, module, window.React, api);

            const ExportedModule = module.exports;
            
            // Check if it exports a register function (New Contract)
            if (typeof ExportedModule.register === 'function') {
                ExportedModule.register(api);
                console.log(`[Extension] Registered ${ext.id}`);
            } 
            // Fallback for Component-based extensions (Old Contract - treat as 'extensions.page' or similar?)
            // For now, let's just support the new 'register' contract for global slots.
            // If it exports 'default', we could map it to a specific legacy slot if needed.
            else if (ExportedModule.default) {
                console.warn(`[Extension] ${ext.id} exports a default component but no register function. Use the new API.`);
            }

        } catch (err) {
            console.error(`[Extension] Failed to load ${ext.id}:`, err);
        }
    };

    useEffect(() => {
        const initExtensions = async () => {
            if (!EXTENSIONS_ENABLED) {
                setLoading(false);
                return;
            }
            if (!window.electronAPI) return;
            const result = await window.electronAPI.getExtensions();
            if (result.success) {
                setInstalledExtensions(result.extensions);
                // Load all
                for (const ext of result.extensions) {
                    await loadExtension(ext);
                }
            }
            setLoading(false);
        };
        initExtensions();
    }, []);

    const getViews = (slotName) => views[slotName] || [];

    return (
        <ExtensionContext.Provider value={{ installedExtensions, loading, getViews }}>
            {children}
        </ExtensionContext.Provider>
    );
};
