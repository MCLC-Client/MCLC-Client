const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const packPath = path.resolve('PVP MISCHE 1.0.0.mrpack');
if (!fs.existsSync(packPath)) {
    console.error('Pack not found at:', packPath);
    process.exit(1);
}

try {
    const zip = new AdmZip(packPath);
    const indexEntry = zip.getEntry('modrinth.index.json');
    if (indexEntry) {
        console.log('--- modrinth.index.json ---');
        console.log(indexEntry.getData().toString('utf8'));
    } else {
        console.error('modrinth.index.json not found in pack');
    }

    console.log('\n--- File List ---');
    zip.getEntries().forEach(entry => {
        console.log(entry.entryName);
    });
} catch (e) {
    console.error('Failed to read zip:', e);
}
