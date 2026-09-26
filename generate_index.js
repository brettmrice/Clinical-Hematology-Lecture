const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const jsonFilePath = path.join(rootDir, 'files_index.json');
const jsFilePath = path.join(rootDir, 'files_data.js');
const videoConfigFile = path.join(rootDir, 'video_links.json');
const videoJsFile = path.join(rootDir, 'video_links.js');

const EXCLUDED_DIRS = ['.git', '.gemini', 'node_modules', '__pycache__', 'scratch'];
const EXCLUDED_FILES = [
    'generate_index.py',
    'generate_index.js',
    'update_course_files.py',
    'files_index.json',
    'files_data.js',
    'video_links.json',
    'video_links.js',
    'package.json',
    'package-lock.json',
    '.gitignore',
    'index.html',
    'styles.css',
    'app.js'
];

const TOPIC_TITLE_MAP = {
    'L1_Hematopoiesis': 'Hematopoiesis',
    'L2_BCE_RBC-HGB': 'Erythrocytes & Hemoglobin',
    'L3_BCE_WBC-PLT': 'Leukocytes & Platelets',
    'L4_RBC_Analysis': 'RBC Analysis',
    'L5_Iron_and_Heme': 'Iron & Heme',
    'L5_Iron_Heme': 'Iron & Heme',
    'L6_Hemoglobinopathies': 'Hemoglobinopathy & Thalassemia',
    'L6_Hemoglobinopathy': 'Hemoglobinopathy & Thalassemia',
    'L7_Macros_Hypos': 'Macrocytic & Hypoproliferative',
    'L8_Hemolytic': 'Hemolytic',
    'L09_Benign': 'Benign Leukocyte Disorders',
    'L9_Benign': 'Benign Leukocyte Disorders',
    'L10_AML': 'Acute Myeloid Leukemia',
    'L11_MPN_MDS': 'MPN & MDS',
    'L12_ALL': 'Acute Lymphoblastic Leukemia',
    'L12_LACLN': 'Lymphoid Neoplasms',
    'L13_BM_Flow': 'Bone Marrow & Flow Cytometry',
    'L1_Manual_Counts': 'Manual Counts',
    'L2_Slide_Preparation': 'Slide Preparation',
    'L3_Slide_Evaluation': 'Slide Evaluation',
    'L4_CBC_Analysis': 'CBC Analysis',
    'L5_Microcytic': 'Microcytic Anemias',
    'L7_Macrocytic': 'Macrocytic',
    'L8_Normocytic': 'Normocytic'
};

function getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const lowerName = filename.toLowerCase();
    if (lowerName.includes('flow_chart') || lowerName.includes('flowchart')) return 'Flow Chart';
    if (ext === '.pdf') return 'Slide Deck';
    if (lowerName.includes('mind_map')) return 'Mind Map';
    if (lowerName.includes('discussion') || lowerName.includes('laboratory_investigation') || lowerName.includes('investigation')) return 'Discussion';
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

function extractDisplayTitle(fullPath, filename, fileType) {
    if (filename.toLowerCase().endsWith('.html') || filename.toLowerCase().endsWith('.htm')) {
        try {
            const content = fs.readFileSync(fullPath, 'utf8').slice(0, 2048);
            const match = content.match(/<title>(.*?)<\/title>/i);
            if (match) {
                const rawTitle = match[1].trim();
                const clean = rawTitle.replace(/\s*[\-\|]\s*(Complete Discussion|Laboratory Investigation|Interactive Mind Map|Discussion|Mind Map|Investigation)\s*$/i, '').trim();
                if (clean) return clean;
            }
        } catch (e) {
            // ignore
        }
    }

    for (const [prefix, topic] of Object.entries(TOPIC_TITLE_MAP)) {
        if (filename.startsWith(prefix)) {
            if (fileType === 'Discussion' || fileType === 'Mind Map') {
                return topic;
            }
            const m = filename.match(/_S\d+_+(.*)\.pdf$/i);
            if (m) {
                let parsedTitle = m[1].replace(/_/g, ' ').replace(/-/g, ' & ').trim();
                if (fileType === 'Flow Chart') {
                    parsedTitle = parsedTitle.replace(/^Flow\s*Chart\s*/i, '').replace(/\s*Flow\s*Chart$/i, '').trim();
                }
                return parsedTitle;
            }
        }
    }

    let clean = path.parse(filename).name;
    clean = clean.replace(/^L\d+_[A-Za-z0-9_-]+?_S\d+_?/, '');
    if (fileType === 'Flow Chart') {
        clean = clean.replace(/flow_?chart/gi, '').trim();
    }
    return clean.replace(/_/g, ' ').trim();
}

function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function loadVideoConfig() {
    if (fs.existsSync(videoConfigFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(videoConfigFile, 'utf8'));
            if (Array.isArray(data)) return data;
        } catch (e) {
            console.error('Error loading video_links.json:', e);
        }
    }
    return [];
}

function syncVideoConfigs(scannedSlideDecks) {
    const existingConfigs = loadVideoConfig();
    const existingByDeck = {};

    existingConfigs.forEach(item => {
        if (item.slide_deck_file) {
            existingByDeck[item.slide_deck_file] = item;
        }
    });

    const missingDecks = scannedSlideDecks.filter(deck => !existingByDeck[deck.name]);

    let updatedConfigs;
    if (!existingConfigs || existingConfigs.length === 0) {
        updatedConfigs = scannedSlideDecks.map(deck => ({
            slide_deck_file: deck.name,
            title: deck.title,
            youtube_url: 'https://youtu.be/PLACEHOLDER'
        }));
    } else {
        updatedConfigs = [...existingConfigs];
        missingDecks.forEach(deck => {
            updatedConfigs.push({
                slide_deck_file: deck.name,
                title: deck.title,
                youtube_url: 'https://youtu.be/PLACEHOLDER'
            });
        });
    }

    try {
        fs.writeFileSync(videoConfigFile, JSON.stringify(updatedConfigs, null, 2), 'utf8');
    } catch (e) {
        console.error('Error writing video_links.json:', e);
    }

    return updatedConfigs;
}

function scanDir() {
    const rawFiles = [];
    const scannedSlideDecks = [];
    const deckCategoryMap = {};

    function walk(dirPath, relativeAcc = '') {
        const items = fs.readdirSync(dirPath);

        for (const item of items) {
            if (EXCLUDED_DIRS.includes(item) || EXCLUDED_FILES.includes(item)) continue;

            const fullPath = path.join(dirPath, item);
            const relPath = path.join(relativeAcc, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                walk(fullPath, relPath);
            } else {
                if (EXCLUDED_FILES.includes(relPath)) continue;

                const fileType = getFileType(item);
                const displayTitle = extractDisplayTitle(fullPath, item, fileType);
                const category = getCategory(relPath);

                const itemEntry = {
                    name: item,
                    title: displayTitle,
                    path: relPath.replace(/\\/g, '/'),
                    size: stat.size,
                    sizeFormatted: formatBytes(stat.size),
                    extension: path.extname(item).toLowerCase().replace('.', ''),
                    type: fileType,
                    category: category,
                    mtime: stat.mtimeMs / 1000
                };

                rawFiles.push(itemEntry);

                if (fileType === 'Slide Deck') {
                    scannedSlideDecks.push(itemEntry);
                    deckCategoryMap[item] = category;
                }
            }
        }
    }

    const targetDirs = ['Laboratory', 'Lecture'];
    for (const target of targetDirs) {
        const targetPath = path.join(rootDir, target);
        if (fs.existsSync(targetPath)) {
            walk(targetPath, target);
        }
    }

    scannedSlideDecks.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));

    const videoConfigs = syncVideoConfigs(scannedSlideDecks);
    const results = [...rawFiles];

    let currentCat = 'General';
    let currentDeckPrefix = '';
    let demoCounter = 0;
    let toolCounter = 0;
    let trainerCounter = 0;

    for (const item of videoConfigs) {
        const deckFile = item.slide_deck_file;
        const targetUrl = item.url || item.youtube_url || 'https://youtu.be/PLACEHOLDER';
        const vTitle = item.title || 'Video';

        if (deckFile) {
            currentCat = deckCategoryMap[deckFile] || 'General';
            const m = deckFile.match(/^(L\d+_[A-Za-z0-9_-]+?)(?:_S\d+|$)/);
            currentDeckPrefix = m ? m[1] : path.parse(deckFile).name;

            const vSortName = deckFile.replace(/\.pdf$/i, '_Video');
            results.push({
                name: vSortName,
                title: vTitle,
                path: targetUrl,
                size: 0,
                sizeFormatted: targetUrl.includes('youtu') ? 'YouTube' : 'Web',
                extension: targetUrl.includes('youtu') ? 'youtube' : 'url',
                type: 'Video',
                category: currentCat,
                youtubeUrl: targetUrl,
                mtime: 0
            });
        } else if (item.tool) {
            // Tool entry
            toolCounter++;
            const descriptor = item.tool;
            const prefixMatch = descriptor.match(/^(L\d+_[A-Za-z0-9_-]+?)(?:_S\d+|_|$)/);
            const prefix = prefixMatch ? prefixMatch[1] : (currentDeckPrefix || 'Tool');
            const cleanTitleSlug = vTitle.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
            const toolName = `${descriptor}_Tool_${cleanTitleSlug}`;

            let cat = item.category;
            if (!cat) {
                const isLab = prefix.startsWith('L') && (prefix.includes('Manual_Counts') || prefix.includes('Slide_Prep') || prefix.includes('Slide_Eval'));
                cat = isLab ? 'Laboratory / CBC_PBS' : currentCat;
            }

            results.push({
                name: toolName,
                title: vTitle,
                path: targetUrl,
                size: 0,
                sizeFormatted: 'Web Tool',
                extension: 'url',
                type: 'Tool',
                category: cat,
                youtubeUrl: targetUrl,
                mtime: 0
            });
        } else if (item.trainer) {
            // Trainer entry
            trainerCounter++;
            const descriptor = item.trainer;
            const prefixMatch = descriptor.match(/^(L\d+_[A-Za-z0-9_-]+?)(?:_S\d+|_|$)/);
            const prefix = prefixMatch ? prefixMatch[1] : (currentDeckPrefix || 'Trainer');
            const cleanTitleSlug = vTitle.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
            const trainerName = `${descriptor}_Trainer_${cleanTitleSlug}`;

            let cat = item.category;
            if (!cat) {
                const isLab = prefix.startsWith('L') && (prefix.includes('Manual_Counts') || prefix.includes('Slide_Prep') || prefix.includes('Slide_Eval'));
                cat = isLab ? 'Laboratory / CBC_PBS' : currentCat;
            }

            results.push({
                name: trainerName,
                title: vTitle,
                path: targetUrl,
                size: 0,
                sizeFormatted: 'Interactive Trainer',
                extension: 'url',
                type: 'Trainer',
                category: cat,
                youtubeUrl: targetUrl,
                mtime: 0
            });
        } else {
            // Demonstration entry (has item.demo or fallback)
            demoCounter++;
            const descriptor = item.demo || `Demo_${demoCounter}`;
            const prefixMatch = descriptor.match(/^(L\d+_[A-Za-z0-9_-]+?)(?:_S\d+|_|$)/);
            const prefix = prefixMatch ? prefixMatch[1] : (currentDeckPrefix || 'Demonstration');
            const cleanTitleSlug = vTitle.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
            const demoName = `${descriptor}_Demo_${cleanTitleSlug}`;

            let cat = item.category;
            if (!cat) {
                const isLab = prefix.startsWith('L') && (prefix.includes('Manual_Counts') || prefix.includes('Slide_Prep') || prefix.includes('Slide_Eval'));
                cat = isLab ? 'Laboratory / CBC_PBS' : currentCat;
            }

            results.push({
                name: demoName,
                title: vTitle,
                path: targetUrl,
                size: 0,
                sizeFormatted: targetUrl.includes('youtu') ? 'YouTube' : 'Web',
                extension: targetUrl.includes('youtu') ? 'youtube' : 'url',
                type: 'Demonstration',
                category: cat,
                youtubeUrl: targetUrl,
                mtime: 0
            });
        }
    }

    return { filesData: results, videoConfigs };
}

try {
    const { filesData, videoConfigs } = scanDir();
    fs.writeFileSync(jsonFilePath, JSON.stringify(filesData, null, 2), 'utf8');
    fs.writeFileSync(jsFilePath, 'window.FILES_DATA = ' + JSON.stringify(filesData, null, 2) + ';\n', 'utf8');
    fs.writeFileSync(videoJsFile, 'window.VIDEO_LINKS = ' + JSON.stringify(videoConfigs, null, 2) + ';\n', 'utf8');
    console.log(`Successfully synced video_links.json (${videoConfigs.length} entries) and indexed ${filesData.length} files to files_index.json, files_data.js, and video_links.js`);
} catch (err) {
    console.error('Error scanning files:', err);
}
