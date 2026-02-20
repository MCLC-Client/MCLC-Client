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