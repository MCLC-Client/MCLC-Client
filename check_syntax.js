const fs = require('fs');
const filepath = 'backend/handlers/instances.js';
const code = fs.readFileSync(filepath, 'utf8');

try {
    new Function(code);
    console.log('Syntax OK');
} catch (e) {
    console.error('Syntax Error found:');
    console.error(e.message);
    const stack = e.stack.split('\n');
    console.error(stack[0]);
    // Try to find the line
    const match = e.stack.match(/<anonymous>:(\d+):(\d+)/);
    if (match) {
        console.error(`Line: ${match[1]}, Column: ${match[2]}`);
    }
}
