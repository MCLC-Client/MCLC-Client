# MCLC Extension Development Guide

Welcome to the MCLC Extension System! This guide will help you create, package, and share extensions.

## 1. File Structure

An extension is a ZIP file (renamed to `.mcextension` or kept as `.zip`) containing the following required structure at the root:

```yaml
my-extension/
├── manifest.json  (Required)
├── main.js        (Required - Entry Point via CJS)
└── (other files)
```

### manifest.json

Defines metadata about your extension.

```json
{
  "id": "my-awesome-extension",
  "name": "My Awesome Extension",
  "version": "1.0.0",
  "description": "Adds a cool new feature.",
  "author": "YourName",
  "main": "main.js" 
}
```

## 2. main.js Format

The extension system runs your code in a sandboxed environment. You must expose specific hooks.

### Lifecycle Hooks

* `activate(api)`: Called when the extension is enabled or the app starts.
* `deactivate()`: Called when the extension is disabled or removed.

### Example `main.js`

```javascript
/* main.js */

// You can create a simple React component
const MyWidget = () => {
    return React.createElement('div', { style: { color: 'white' } }, "Hello from Extension!");
};

// Activate Hook
exports.activate = async (api) => {
    console.log("Extension activated!");

    // 1. Show a Toast Notification
    api.ui.toast("My Extension Loaded!", "success");

    // 2. Register a UI Component to a Slot
    // Available Slots: 'sidebar.bottom'
    api.ui.registerView('sidebar.bottom', MyWidget);

    // 3. Use Storage
    const runCount = api.storage.get('runCount') || 0;
    api.storage.set('runCount', runCount + 1);
};

// Deactivate Hook
exports.deactivate = async () => {
    console.log("Extension deactivated!");
    // Cleanup is handled automatically for UI views, but stop any timers/intervals here.
};
```

## 3. Packaging

1. Select all files inside your extension folder (manifest.json, main.js, etc.).
2. Right-click -> **Compress to ZIP file**.
3. (Optional) Rename `.zip` to `.mcextension`.
4. Your extension is ready to upload!

## 4. Troubleshooting

* **"Missing main.js"**: Ensure `main.js` is at the *root* of the zip, not inside a subfolder.
* **Check Console**: Open Developer Tools (Ctrl+Shift+I) to see logs from your extension.
