try {
    const handlers = [
        '../backend/handlers/auth',
        '../backend/handlers/instances',
        '../backend/handlers/launcher',
        '../backend/handlers/modrinth',
        '../backend/handlers/data',
        '../backend/handlers/settings',
        '../backend/handlers/discord'
    ];

    handlers.forEach(h => {
        require(h);
        console.log(`Successfully required ${h}`);
    });
    console.log("All handlers required successfully.");
} catch (e) {
    console.error("Verification failed:", e.message);
    process.exit(1);
}
