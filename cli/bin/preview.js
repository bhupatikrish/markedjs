#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// In a real CLI, we might import the backend logic as a library
// For this POC, we'll shell out to the backend or require its index if it exported app
// easier to just run the backend server script but correctly positioned

console.log('Starting MarkedJS Preview Server...');

// We need to resolve the backend path relative to this script
const backendScript = path.resolve(__dirname, '../../backend/src/index.js');
if (!fs.existsSync(backendScript)) {
    console.error('Error: Could not find backend script at', backendScript);
    process.exit(1);
}

const { startServer } = require(backendScript);

const args = process.argv.slice(2);
const targetDir = args[0] ? path.resolve(process.cwd(), args[0]) : null;

if (targetDir) {
    console.log(`Scoped preview: ${targetDir}`);
} else {
    console.log(`Global preview mode`);
}

try {
    startServer(3000, targetDir);
} catch (e) {
    console.error('Failed to start backend:', e);
    process.exit(1);
}
