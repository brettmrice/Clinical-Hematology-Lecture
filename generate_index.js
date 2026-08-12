const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const outputFilePath = path.join(rootDir, 'files_index.json');

const EXCLUDED_DIRS = ['.git', '.gemini', 'node_modules'];
const EXCLUDED_FILES = ['generate_index.js', 'files_index.json', 'package.json', 'package-lock.json', '.gitignore'];

function getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const lowerName = filename.toLowerCase();
    if (ext === '.pdf') return 'PDF Slide';
    if (lowerName.includes('mind_map')) return 'Mind Map';
    if (lowerName.includes('discussion')) return 'Discussion';
    if (ext === '.html' || ext === '.htm') return 'HTML Note';
    if (ext === '.md') return 'Markdown Document';
    return 'Document';
}

function getCategory(relPath) {
    const parts = relPath.split(path.sep);
    if (parts.length > 1) {
        return parts.slice(0, -1).join(' / ');
    }
    return 'General';
}

function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function scanDir(dirPath, relativeAcc = '') {
    let results = [];
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
        if (EXCLUDED_DIRS.includes(item) || EXCLUDED_FILES.includes(item)) continue;
        
        const fullPath = path.join(dirPath, item);
        const relPath = path.join(relativeAcc, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            results = results.concat(scanDir(fullPath, relPath));
        } else {
            // Ignore root web files created for the viewer itself
            if (['index.html', 'styles.css', 'app.js'].includes(item) && relativeAcc === '') {
                continue;
            }
            results.push({
                name: item,
                path: relPath.replace(/\\/g, '/'),
                size: stat.size,
                sizeFormatted: formatBytes(stat.size),
                extension: path.extname(item).toLowerCase().replace('.', ''),
                type: getFileType(item),
                category: getCategory(relPath),
                mtime: stat.mtime
            });
        }
    }
    return results;
}

try {
    const files = scanDir(rootDir);
    fs.writeFileSync(outputFilePath, JSON.stringify(files, null, 2), 'utf8');
    console.log(`Successfully indexed ${files.length} files to files_index.json`);
} catch (err) {
    console.error('Error scanning files:', err);
}
