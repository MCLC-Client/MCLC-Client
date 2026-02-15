import React, { useEffect, useState } from 'react';

const ExtensionLoader = ({ extensionPath, ...props }) => {
    const [Component, setComponent] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadExtension = async () => {
            try {
                // Construct the URL for the extension entry point
                // Using app-media protocol to fetch the local file
                const importUrl = `app-media:///${extensionPath}`;
                
                // Fetch the transpiled CJS code
                const response = await fetch(importUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch extension: ${response.statusText}`);
                }
                const code = await response.text();

                // Define a custom require function to inject dependencies
                const customRequire = (moduleName) => {
                    if (moduleName === 'react') return window.React;
                    if (moduleName === 'react-dom') return window.ReactDOM;
                    if (moduleName === 'react-dom/client') return window.ReactDOM;
                    // We can add more exposed modules here (e.g. valid UI components)
                    throw new Error(`Cannot find module '${moduleName}'`);
                };

                const exports = {};
                const module = { exports };

                // Wrap code in a function to provide CJS scope (require, exports, module)
                // We use new Function to avoid eval() strict mode quirks, though similar.
                const wrapper = new Function('require', 'exports', 'module', 'React', code);
                
                // Execute
                wrapper(customRequire, exports, module, window.React);

                // Get the exported component
                const ExportedComponent = module.exports.default || module.exports;

                if (ExportedComponent) {
                    setComponent(() => ExportedComponent);
                } else {
                    throw new Error("Extension did not export a default component");
                }
            } catch (err) {
                console.error("Failed to load extension:", err);
                setError(err.message);
            }
        };

        if (extensionPath) {
            loadExtension();
        }
    }, [extensionPath]);

    if (error) {
        return <div className="p-4 text-red-500 bg-red-900/20 rounded">Failed to load extension: {error}</div>;
    }

    if (!Component) {
        return <div className="p-4 text-gray-400">Loading extension...</div>;
    }

    return <Component {...props} />;
};

export default ExtensionLoader;
