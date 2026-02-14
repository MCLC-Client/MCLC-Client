const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/beatv/Desktop/Test/MinecraftLauncher/backend/handlers/instances.js';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split(/\r?\n/);

// Lines to remove: 867 to 1234 (1-indexed)
// Indices: 866 to 1233
const startLine = 867;
const endLine = 1234;

if (lines.length < endLine) {
    console.error(`File too short: ${lines.length} lines`);
    process.exit(1);
}

// Check first line to be sure
const firstLineToRemove = lines[startLine - 1];
if (!firstLineToRemove.includes('// Background installation functions')) {
    console.error(`Unexpected line at ${startLine}: ${firstLineToRemove}`);
    process.exit(1);
}

const lastLineToRemove = lines[endLine - 1];
if (lastLineToRemove.trim() !== '};') {
    console.error(`Unexpected line at ${endLine}: ${lastLineToRemove}`);
    process.exit(1);
}

// Remove lines
lines.splice(startLine - 1, endLine - startLine + 1);

fs.writeFileSync(filePath, lines.join('\n'));
console.log('Successfully removed lines.');
