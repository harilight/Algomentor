const fs = require('fs');

const activeTempFiles = new Set();

function trackTempFile(filePath) {
    if (filePath) activeTempFiles.add(filePath);
}

function cleanupTempFile(filePath) {
    if (!filePath) return;
    activeTempFiles.delete(filePath);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
}

function cleanupAllTempFiles() {
    for (const file of activeTempFiles) {
        try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (e) {}
    }
    activeTempFiles.clear();
}

process.on('exit', cleanupAllTempFiles);
process.on('SIGINT', () => { cleanupAllTempFiles(); process.exit(0); });
process.on('SIGTERM', () => { cleanupAllTempFiles(); process.exit(0); });
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    cleanupAllTempFiles();
    process.exit(1);
});

module.exports = {
    trackTempFile,
    cleanupTempFile,
    cleanupAllTempFiles
};
