let filesData = [];
let currentSection = 'all'; // 'all', 'lecture', or 'laboratory'
let currentModule = 'all';  // 'all', 'Physiology', 'CBC_PBS', 'Erythrocyte', or 'Leukocyte'
let currentFilter = 'all';   // 'all', 'discussion', 'pdf', 'video', or 'mindmap'
let currentSearch = '';
let currentView = 'grid';   // 'grid' or 'tree'

const TOPIC_CONFIG = {
    lecture: {
        'L1_Hematopoiesis': 'Hematopoiesis',
        'L2_BCE_RBC-HGB': 'Erythrocytes & Hemoglobin',
        'L3_BCE_WBC-PLT': 'Leukocytes & Platelets',
        'L4_RBC_Analysis': 'RBC Analysis',
        'L5_Iron_Heme': 'Iron & Heme',
        'L6_Hemoglobinopathy': 'Hemoglobinopathy',
        'L7_Macros_Hypos': 'Macrocytic & Hypoproliferative',
        'L8_Hemolytic': 'Hemolytic',
        'L09_Benign': 'Benign Disorders',
        'L10_AML': 'Acute Myeloid Neoplasms',
        'L11_MPN_MDS': 'Chronic Myeloid Neoplasms',
        'L12_ALL': 'Lymphoid Neoplasms',
        'L13_BM_Flow': 'Bone Marrow & Flow Cytometry'
    },
    laboratory: {
        'L1_Manual_Counts': 'Manual Counts',
        'L2_Slide_Preparation': 'Slide Preparation',
        'L3_Slide_Evaluation': 'Slide Evaluation',
        'L4_CBC_Analysis': 'CBC Analysis',
        'L5_Microcytic': 'Microcytic',
        'L6_Hemoglobinopathy': 'Hemoglobinopathy',
        'L7_Macrocytic': 'Macrocytic',
        'L8_Normocytic': 'Normocytic',
        'L09_Benign': 'Benign Disorders',
        'L10_AML': 'Acute Myeloid Neoplasms',
        'L11_MPN_MDS': 'Chronic Myeloid Neoplasms',
        'L12_LACLN': 'Lymphoid Neoplasms',
        'L13_BM_Flow': 'Bone Marrow & Flow Cytometry'
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadFilesIndex();
    setupEventListeners();
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('chgh_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('chgh_theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const iconBtn = document.getElementById('themeToggleBtn');
    if (!iconBtn) return;
    if (theme === 'dark') {
        iconBtn.innerHTML = `
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
        `;
        iconBtn.title = "Switch to Light Mode";
    } else {
        iconBtn.innerHTML = `
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
        `;
        iconBtn.title = "Switch to Dark Mode";
    }
}

// Fetch / Load Files Data
async function loadFilesIndex() {
    if (window.location.hash && 'scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
        window.scrollTo(0, 0);
    }

    try {
        // Priority 1: Check if window.FILES_DATA is loaded (works seamlessly on file:// protocol without CORS restriction)
        if (window.FILES_DATA && Array.isArray(window.FILES_DATA) && window.FILES_DATA.length > 0) {
            filesData = window.FILES_DATA;
            updateCategoryCounts();
            render();
            return;
        }

        // Priority 2: Try fetching files_index.json (for web server / HTTP environments)
        const response = await fetch('./files_index.json');
        if (!response.ok) throw new Error('Failed to load file index');
        filesData = await response.json();
        updateCategoryCounts();
        render();
    } catch (err) {
        console.error('Error loading files index:', err);
        document.getElementById('contentContainer').innerHTML = `
            <div class="empty-state">
                <p>Could not load files index. Please ensure <code>files_data.js</code> or <code>files_index.json</code> is generated.</p>
            </div>
        `;
    }
}

// Topic & Category Helpers
function getTopicInfo(file) {
    const domain = getDomainKey(file);
    const domainConfig = TOPIC_CONFIG[domain] || {};

    for (const [prefix, title] of Object.entries(domainConfig)) {
        if (file.name.startsWith(prefix)) {
            return {
                key: prefix,
                title: title,
                domain: domain
            };
        }
    }

    const match = file.name.match(/^(L0?\d+)_([A-Za-z0-9_-]+?)(?:_S\d+|_Demo_\d+|_Tool_\d+|_Demo_|_Tool_|$)/i);
    if (match) {
        const unitNum = match[1].toUpperCase().replace(/^L0/, 'L');
        const topicRaw = match[2].replace(/_/g, ' ').replace(/-/g, ' & ');
        return {
            key: `${unitNum}_${match[2]}`,
            title: `${unitNum} · ${topicRaw}`,
            domain: domain
        };
    }

    return {
        key: 'Other',
        title: 'General Resources',
        domain: domain
    };
}

function formatCategory(cat) {
    if (!cat) return 'General';
    return cat
        .replace(/CBC_PBS/gi, 'CBC & PBS')
        .replace(/\s*\/\s*/g, ' · ')
        .trim();
}

function getDomainKey(file) {
    const cat = (file.category || '').toLowerCase();
    if (cat.includes('laboratory') || cat.includes('lab')) return 'laboratory';
    return 'lecture';
}

function getModuleKey(file) {
    const cat = (file.category || '').toLowerCase();
    const path = (file.path || '').toLowerCase();
    if (cat.includes('physiology') || path.includes('/physiology/')) return 'Physiology';
    if (cat.includes('cbc_pbs') || cat.includes('cbc & pbs') || path.includes('/cbc_pbs/')) return 'CBC_PBS';
    if (cat.includes('erythrocyte') || path.includes('/erythrocytes/') || path.includes('/erythrocyte/')) return 'Erythrocyte';
    if (cat.includes('leukocyte') || path.includes('/leukocytes/') || path.includes('/leukocyte/')) return 'Leukocyte';
    return 'Other';
}

function getBadgeLabel(file) {
    const lowerName = (file.name || '').toLowerCase();
    const lowerTitle = (file.title || '').toLowerCase();
    if (lowerName.includes('investigation') || lowerTitle.includes('investigation')) {
        return 'Investigation';
    }
    return file.type;
}

function cleanDisplayTitle(rawTitle, fileName) {
    let title = rawTitle || fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    return title.replace(/\s*[\-\|]\s*(Complete Discussion|Laboratory Investigation|Interactive Mind Map|Discussion|Mind Map|Investigation)\s*$/gi, '').trim();
}

// Setup Event Listeners
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value.toLowerCase().trim();
            updateCategoryCounts();
            render();
        });
    }

    // Theme Toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }

    // Domain / Folder Filter Chips (All, Lecture, Laboratory)
    const domainChips = document.querySelectorAll('.chip-domain');
    domainChips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (chip.disabled || chip.classList.contains('is-disabled')) return;
            domainChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentSection = chip.getAttribute('data-domain');
            updateCategoryCounts();
            render();
        });
    });

    // Module / Subfolder Filter Chips (All, Physiology, CBC & PBS, Erythrocyte)
    const moduleChips = document.querySelectorAll('.chip-module');
    moduleChips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (chip.disabled || chip.classList.contains('is-disabled')) return;
            moduleChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentModule = chip.getAttribute('data-module');
            updateCategoryCounts();
            render();
        });
    });

    // Resource Type Filter Chips
    const typeChips = document.querySelectorAll('.chip-type');
    typeChips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (chip.disabled || chip.classList.contains('is-disabled')) return;
            typeChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.getAttribute('data-filter');
            updateCategoryCounts();
            render();
        });
    });

    // View Toggle (Grid / Tree)
    const btnGrid = document.getElementById('btnViewGrid');
    const btnTree = document.getElementById('btnViewTree');
    
    if (btnGrid && btnTree) {
        btnGrid.addEventListener('click', () => {
            currentView = 'grid';
            btnGrid.classList.add('active');
            btnTree.classList.remove('active');
            render();
        });
        btnTree.addEventListener('click', () => {
            currentView = 'tree';
            btnTree.classList.add('active');
            btnGrid.classList.remove('active');
            render();
        });
    }

    // Modal Close
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalBackdrop = document.getElementById('modalBackdrop');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', (e) => {
            if (e.target === modalBackdrop) closeModal();
        });
    }

    // Keydown for Modal ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Hash change for shareable link targeting
    window.addEventListener('hashchange', checkUrlHashTarget);
}

// Check if a file matches text search query
function fileMatchesSearch(file, searchStr) {
    if (!searchStr) return true;
    const topicInfo = getTopicInfo(file);
    const matchName = (file.name || '').toLowerCase().includes(searchStr);
    const matchTitle = (file.title || '').toLowerCase().includes(searchStr);
    const matchCat = (file.category || '').toLowerCase().includes(searchStr);
    const matchType = (file.type || '').toLowerCase().includes(searchStr);
    const matchTopic = (topicInfo.title || '').toLowerCase().includes(searchStr);
    return matchName || matchTitle || matchCat || matchType || matchTopic;
}

// Update count and disabled state for a specific chip
function updateChipState(chipEl, countEl, count) {
    if (countEl) countEl.textContent = count;
    if (!chipEl) return;
    const isDisabled = count === 0;
    chipEl.disabled = isDisabled;
    if (isDisabled) {
        chipEl.classList.add('is-disabled');
    } else {
        chipEl.classList.remove('is-disabled');
    }
}

// Count items for domain chips, module chips, and type chips with dynamic 0-count disabling & auto-reset
function updateCategoryCounts() {
    // 1. Files matching current search
    const searchFiles = filesData.filter(f => fileMatchesSearch(f, currentSearch));

    // Type filter mapping
    const typeFilters = {
        'discussion': 'Discussion',
        'flowchart': 'Flow Chart',
        'pdf': 'Slide Deck',
        'video': 'Video',
        'demonstration': 'Demonstration',
        'tool': 'Tool',
        'trainer': 'Trainer',
        'mindmap': 'Mind Map'
    };

    // Helper to test if file matches current type filter
    const matchesCurrentType = (f) => {
        if (currentFilter === 'all') return true;
        const targetType = typeFilters[currentFilter];
        return targetType ? f.type === targetType : true;
    };

    // Helper to test if file matches current module filter
    const matchesCurrentModule = (f) => {
        if (currentModule === 'all') return true;
        return getModuleKey(f) === currentModule;
    };

    // Helper to test if file matches current domain filter
    const matchesCurrentDomain = (f) => {
        if (currentSection === 'all') return true;
        return getDomainKey(f) === currentSection;
    };

    // --- DOMAIN / FOLDER CHIPS ---
    // Scoped to: Search + Module + Type
    const domainCandidateFiles = searchFiles.filter(f => matchesCurrentModule(f) && matchesCurrentType(f));
    const countDomainAll = domainCandidateFiles.length;
    const countDomainLecture = domainCandidateFiles.filter(f => getDomainKey(f) === 'lecture').length;
    const countDomainLab = domainCandidateFiles.filter(f => getDomainKey(f) === 'laboratory').length;

    // Check if active domain has 0 items and auto-reset to 'all' if needed
    if (currentSection === 'lecture' && countDomainLecture === 0) {
        currentSection = 'all';
    } else if (currentSection === 'laboratory' && countDomainLab === 0) {
        currentSection = 'all';
    }

    const chipDomAll = document.getElementById('tabDomainAll');
    const chipDomLec = document.getElementById('tabDomainLecture');
    const chipDomLab = document.getElementById('tabDomainLab');

    updateChipState(chipDomAll, document.getElementById('countDomainAll'), countDomainAll);
    updateChipState(chipDomLec, document.getElementById('countDomainLecture'), countDomainLecture);
    updateChipState(chipDomLab, document.getElementById('countDomainLab'), countDomainLab);

    // Sync active classes for domain chips
    const domainChips = document.querySelectorAll('.chip-domain');
    domainChips.forEach(c => {
        if (c.getAttribute('data-domain') === currentSection) {
            c.classList.add('active');
        } else {
            c.classList.remove('active');
        }
    });

    // --- MODULE CHIPS ---
    // Scoped to: Search + Active Domain + Type
    const moduleCandidateFiles = searchFiles.filter(f => matchesCurrentDomain(f) && matchesCurrentType(f));
    const countModAll = moduleCandidateFiles.length;
    const countModPhys = moduleCandidateFiles.filter(f => getModuleKey(f) === 'Physiology').length;
    const countModCBC = moduleCandidateFiles.filter(f => getModuleKey(f) === 'CBC_PBS').length;
    const countModEryth = moduleCandidateFiles.filter(f => getModuleKey(f) === 'Erythrocyte').length;
    const countModLeuk = moduleCandidateFiles.filter(f => getModuleKey(f) === 'Leukocyte').length;

    // Check if active module has 0 items and auto-reset to 'all' if needed
    if (currentModule === 'Physiology' && countModPhys === 0) {
        currentModule = 'all';
    } else if (currentModule === 'CBC_PBS' && countModCBC === 0) {
        currentModule = 'all';
    } else if (currentModule === 'Erythrocyte' && countModEryth === 0) {
        currentModule = 'all';
    } else if (currentModule === 'Leukocyte' && countModLeuk === 0) {
        currentModule = 'all';
    }

    const chipModAll = document.getElementById('tabModuleAll');
    const chipModPhys = document.getElementById('tabModulePhysiology');
    const chipModCBC = document.getElementById('tabModuleCBC');
    const chipModEryth = document.getElementById('tabModuleErythrocyte');
    const chipModLeuk = document.getElementById('tabModuleLeukocyte');

    updateChipState(chipModAll, document.getElementById('countModuleAll'), countModAll);
    updateChipState(chipModPhys, document.getElementById('countModulePhysiology'), countModPhys);
    updateChipState(chipModCBC, document.getElementById('countModuleCBC'), countModCBC);
    updateChipState(chipModEryth, document.getElementById('countModuleErythrocyte'), countModEryth);
    updateChipState(chipModLeuk, document.getElementById('countModuleLeukocyte'), countModLeuk);

    // Sync active classes for module chips
    const moduleChips = document.querySelectorAll('.chip-module');
    moduleChips.forEach(c => {
        if (c.getAttribute('data-module') === currentModule) {
            c.classList.add('active');
        } else {
            c.classList.remove('active');
        }
    });

    // --- RESOURCE TYPE CHIPS ---
    // Scoped to: Search + Active Domain + Active Module
    const typeCandidateFiles = searchFiles.filter(f => matchesCurrentDomain(f) && matchesCurrentModule(f));
    const countTypeAll = typeCandidateFiles.length;
    const countDisc = typeCandidateFiles.filter(f => f.type === 'Discussion').length;
    const countFlowChart = typeCandidateFiles.filter(f => f.type === 'Flow Chart').length;
    const countPdf = typeCandidateFiles.filter(f => f.type === 'Slide Deck').length;
    const countVideo = typeCandidateFiles.filter(f => f.type === 'Video').length;
    const countDemo = typeCandidateFiles.filter(f => f.type === 'Demonstration').length;
    const countTool = typeCandidateFiles.filter(f => f.type === 'Tool').length;
    const countTrainer = typeCandidateFiles.filter(f => f.type === 'Trainer').length;
    const countMaps = typeCandidateFiles.filter(f => f.type === 'Mind Map').length;

    // Check if active type has 0 items and auto-reset to 'all' if needed
    const activeTypeCounts = {
        'discussion': countDisc,
        'flowchart': countFlowChart,
        'pdf': countPdf,
        'video': countVideo,
        'demonstration': countDemo,
        'tool': countTool,
        'trainer': countTrainer,
        'mindmap': countMaps
    };
    if (currentFilter !== 'all' && (activeTypeCounts[currentFilter] || 0) === 0) {
        currentFilter = 'all';
    }

    const typeChipMap = {
        'all': { chip: document.querySelector('.chip-type[data-filter="all"]'), countEl: document.getElementById('countAll'), count: countTypeAll },
        'discussion': { chip: document.querySelector('.chip-type[data-filter="discussion"]'), countEl: document.getElementById('countDisc'), count: countDisc },
        'flowchart': { chip: document.querySelector('.chip-type[data-filter="flowchart"]'), countEl: document.getElementById('countFlowChart'), count: countFlowChart },
        'pdf': { chip: document.querySelector('.chip-type[data-filter="pdf"]'), countEl: document.getElementById('countPdf'), count: countPdf },
        'video': { chip: document.querySelector('.chip-type[data-filter="video"]'), countEl: document.getElementById('countVideo'), count: countVideo },
        'demonstration': { chip: document.querySelector('.chip-type[data-filter="demonstration"]'), countEl: document.getElementById('countDemo'), count: countDemo },
        'tool': { chip: document.querySelector('.chip-type[data-filter="tool"]'), countEl: document.getElementById('countTool'), count: countTool },
        'trainer': { chip: document.querySelector('.chip-type[data-filter="trainer"]'), countEl: document.getElementById('countTrainer'), count: countTrainer },
        'mindmap': { chip: document.querySelector('.chip-type[data-filter="mindmap"]'), countEl: document.getElementById('countMaps'), count: countMaps }
    };

    for (const item of Object.values(typeChipMap)) {
        updateChipState(item.chip, item.countEl, item.count);
    }

    // Sync active classes for type chips
    const typeChips = document.querySelectorAll('.chip-type');
    typeChips.forEach(c => {
        if (c.getAttribute('data-filter') === currentFilter) {
            c.classList.add('active');
        } else {
            c.classList.remove('active');
        }
    });
}

// Filter logic
function getFilteredFiles() {
    const filtered = filesData.filter(file => {
        // 1. Folder / Domain filter (All, Lecture, Laboratory)
        const domain = getDomainKey(file);
        if (currentSection === 'lecture' && domain !== 'lecture') return false;
        if (currentSection === 'laboratory' && domain !== 'laboratory') return false;

        // 2. Module / Subfolder filter (All, Physiology, CBC & PBS, Erythrocyte)
        if (currentModule !== 'all') {
            const mod = getModuleKey(file);
            if (mod !== currentModule) return false;
        }

        // 3. Resource type filter chip
        if (currentFilter === 'discussion' && file.type !== 'Discussion') return false;
        if (currentFilter === 'flowchart' && file.type !== 'Flow Chart') return false;
        if (currentFilter === 'pdf' && file.type !== 'Slide Deck') return false;
        if (currentFilter === 'video' && file.type !== 'Video') return false;
        if (currentFilter === 'demonstration' && file.type !== 'Demonstration') return false;
        if (currentFilter === 'tool' && file.type !== 'Tool') return false;
        if (currentFilter === 'trainer' && file.type !== 'Trainer') return false;
        if (currentFilter === 'mindmap' && file.type !== 'Mind Map') return false;

        // 4. Search text query
        if (currentSearch && !fileMatchesSearch(file, currentSearch)) {
            return false;
        }

        return true;
    });

    // Sort cards in natural deterministic order
    return filtered.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
}

// Main Render Function
function render() {
    const container = document.getElementById('contentContainer');
    const filtered = getFilteredFiles();

    const statsEl = document.getElementById('resultsStats');
    if (statsEl) {
        statsEl.textContent = `Showing ${filtered.length} of ${filesData.length} files`;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3>No matching files found</h3>
                <p>Try adjusting your search terms, section tab, or filter criteria.</p>
            </div>
        `;
        return;
    }

    if (currentView === 'grid') {
        renderCardGrid(container, filtered);
    } else {
        renderTree(container, filtered);
    }

    setTimeout(checkUrlHashTarget, 200);
}

// Helper: Group files into Domain -> Category -> Topics -> Types hierarchy
function buildHierarchy(files) {
    const domains = {
        'lecture': { title: 'Lecture Modules', badge: 'Lecture', icon: 'lecture', categories: {} },
        'laboratory': { title: 'Laboratory Modules', badge: 'Laboratory', icon: 'lab', categories: {} }
    };

    files.forEach(file => {
        const dKey = getDomainKey(file);
        const catKey = file.category || 'General';
        const topicInfo = getTopicInfo(file);

        if (!domains[dKey]) {
            domains[dKey] = { title: `${dKey.toUpperCase()} Modules`, badge: dKey, icon: 'lecture', categories: {} };
        }

        if (!domains[dKey].categories[catKey]) {
            domains[dKey].categories[catKey] = {
                categoryName: catKey,
                formattedName: formatCategory(catKey),
                topics: {}
            };
        }

        const catObj = domains[dKey].categories[catKey];
        if (!catObj.topics[topicInfo.key]) {
            catObj.topics[topicInfo.key] = {
                key: topicInfo.key,
                title: topicInfo.title,
                files: []
            };
        }

        catObj.topics[topicInfo.key].files.push(file);
    });

    return domains;
}

function getMindMapUrlWithStats(filePath) {
    if (!filePath || !filePath.includes('Mind_Map.html')) return filePath;
    try {
        let statsJson = '';
        if (window.name) {
            try {
                const parsed = JSON.parse(window.name);
                if (parsed && (parsed.stats || parsed.__chgh_quiz_signature__)) {
                    statsJson = JSON.stringify(parsed.stats || parsed);
                }
            } catch(e) {}
        }
        if (!statsJson) {
            statsJson = localStorage.getItem('CHGH_MINDMAP_QUIZ_STATS_V2') || sessionStorage.getItem('CHGH_MINDMAP_QUIZ_STATS_V2') || '';
        }
        if (statsJson) {
            const enc = encodeURIComponent(btoa(unescape(encodeURIComponent(statsJson))));
            return filePath + '#mmq=' + enc;
        }
    } catch(e) {}
    return filePath;
}

// Render Card Grid
function renderCardGrid(container, files) {
    const hierarchy = buildHierarchy(files);
    let html = '';

    const domainKeys = ['lecture', 'laboratory'];

    domainKeys.forEach(dKey => {
        const domain = hierarchy[dKey];
        if (!domain) return;

        const categories = domain.categories;
        const catKeys = Object.keys(categories);
        if (catKeys.length === 0) return;

        // Calculate total files in this domain
        let domainFileCount = 0;
        catKeys.forEach(ck => {
            Object.values(categories[ck].topics).forEach(t => {
                domainFileCount += t.files.length;
            });
        });

        if (domainFileCount === 0) return;

        const domainIconSvg = dKey === 'laboratory' ? `
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
            </svg>
        ` : `
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
            </svg>
        `;

        html += `
            <div class="domain-section">
                <div class="domain-header">
                    <div class="domain-title">
                        ${domainIconSvg}
                        <span>${escapeHtml(domain.title)}</span>
                    </div>
                    <span class="domain-badge">${escapeHtml(domain.badge)} · ${domainFileCount} items</span>
                </div>
        `;

        catKeys.forEach(ck => {
            const cat = categories[ck];
            const topicKeys = Object.keys(cat.topics);

            topicKeys.forEach(tKey => {
                const topic = cat.topics[tKey];
                const topicFiles = topic.files;
                if (topicFiles.length === 0) return;

                // Group files within topic into type sub-rows
                const typeSubgroups = {
                    'Discussion': [],
                    'Flow Chart': [],
                    'Slide Deck': [],
                    'Video': [],
                    'Demonstration': [],
                    'Tool': [],
                    'Trainer': [],
                    'Mind Map': [],
                    'Other': []
                };

                topicFiles.forEach(file => {
                    if (typeSubgroups[file.type]) {
                        typeSubgroups[file.type].push(file);
                    } else {
                        typeSubgroups['Other'].push(file);
                    }
                });

                html += `
                    <div class="topic-group">
                        <div class="topic-title">
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                            </svg>
                            ${escapeHtml(topic.title)} (${topicFiles.length})
                        </div>
                `;

                const typeOrder = ['Discussion', 'Flow Chart', 'Slide Deck', 'Video', 'Demonstration', 'Tool', 'Trainer', 'Mind Map', 'Other'];
                typeOrder.forEach(typeKey => {
                    const subFiles = typeSubgroups[typeKey];
                    if (!subFiles || subFiles.length === 0) return;

                    let typeLabel = typeKey;
                    if (typeKey === 'Flow Chart') typeLabel = 'Flow Charts';
                    if (typeKey === 'Slide Deck') typeLabel = 'Slide Decks';
                    if (typeKey === 'Video') typeLabel = 'Videos';
                    if (typeKey === 'Demonstration') typeLabel = 'Demonstrations';
                    if (typeKey === 'Tool') typeLabel = 'Interactive Tools';
                    if (typeKey === 'Trainer') typeLabel = 'Trainers';
                    if (typeKey === 'Mind Map') typeLabel = 'Mind Maps';
                    if (typeKey === 'Discussion') typeLabel = 'Discussions';

                    html += `
                        <div class="subrow-group">
                            <div class="subrow-title">
                                ${escapeHtml(typeLabel)} (${subFiles.length})
                            </div>
                            <div class="grid-view">
                    `;

                    subFiles.forEach(file => {
                        let badgeClass = 'badge-doc';
                        if (file.type === 'Flow Chart') badgeClass = 'badge-flowchart';
                        if (file.type === 'Slide Deck') badgeClass = 'badge-pdf';
                        if (file.type === 'Video') badgeClass = 'badge-video';
                        if (file.type === 'Demonstration') badgeClass = 'badge-demo';
                        if (file.type === 'Tool') badgeClass = 'badge-tool';
                        if (file.type === 'Trainer') badgeClass = 'badge-trainer';
                        if (file.type === 'Mind Map') badgeClass = 'badge-map';

                        const displayTitle = cleanDisplayTitle(file.title, file.name);
                        const cardDomId = 'card-' + file.name.replace(/[^a-zA-Z0-9_-]/g, '_');
                        const catFormatted = formatCategory(file.category);
                        const badgeLabel = getBadgeLabel(file);

                        const mindMapHref = file.type === 'Mind Map' ? getMindMapUrlWithStats(file.path) : file.path;
                        html += `
                            <div class="card" id="${cardDomId}" onclick="openPreview('${encodeURIComponent(file.path)}', '${escapeJsString(displayTitle)}')">
                                <div>
                                    <div class="card-header">
                                        <span class="card-badge ${badgeClass}">${badgeLabel}</span>
                                        <span class="card-category">${escapeHtml(catFormatted)}</span>
                                    </div>
                                    <div class="card-title">${escapeHtml(displayTitle)}</div>
                                </div>
                                <div class="card-actions">
                                    <button class="btn btn-preview" onclick="openPreview('${encodeURIComponent(file.path)}', '${escapeJsString(displayTitle)}'); event.stopPropagation();">
                                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                        </svg>
                                        Preview
                                    </button>
                                    <a class="btn btn-open" href="${encodeURI(mindMapHref)}" target="_blank" rel="opener" title="Open in new tab" onclick="event.stopPropagation();">
                                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                        </svg>
                                        Open
                                    </a>
                                    <button class="btn btn-share btn-icon-only" title="Copy shareable link" onclick="copyShareLink('${escapeJsString(file.name)}'); event.stopPropagation();">
                                        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        `;
                    });

                    html += `
                            </div>
                        </div>
                    `;
                });

                html += `</div>`; // end topic-group
            });
        });

        html += `</div>`; // end domain-section
    });

    container.innerHTML = html;
}

// Render Directory Tree
function renderTree(container, files) {
    const hierarchy = buildHierarchy(files);
    let html = `<div class="tree-view">`;

    const domainKeys = ['lecture', 'laboratory'];

    domainKeys.forEach(dKey => {
        const domain = hierarchy[dKey];
        if (!domain) return;

        const categories = domain.categories;
        const catKeys = Object.keys(categories);
        if (catKeys.length === 0) return;

        catKeys.forEach(ck => {
            const cat = categories[ck];
            const topicKeys = Object.keys(cat.topics);

            topicKeys.forEach(tKey => {
                const topic = cat.topics[tKey];
                const topicFiles = topic.files;
                if (topicFiles.length === 0) return;

                const typeSubgroups = {
                    'Discussion': [],
                    'Flow Chart': [],
                    'Slide Deck': [],
                    'Video': [],
                    'Demonstration': [],
                    'Tool': [],
                    'Trainer': [],
                    'Mind Map': [],
                    'Other': []
                };

                topicFiles.forEach(file => {
                    if (typeSubgroups[file.type]) {
                        typeSubgroups[file.type].push(file);
                    } else {
                        typeSubgroups['Other'].push(file);
                    }
                });

                html += `
                    <div class="tree-folder" style="margin-bottom: 24px;">
                        <div class="tree-folder-title">
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                            </svg>
                            <span>${escapeHtml(domain.badge)} · ${escapeHtml(topic.title)}</span>
                            <span style="font-size:0.75rem; font-weight: normal; margin-left: auto; opacity: 0.8;">${topicFiles.length} items</span>
                        </div>
                        <div class="tree-folder-items" style="padding-left: 8px;">
                `;

                const typeOrder = ['Discussion', 'Flow Chart', 'Slide Deck', 'Video', 'Demonstration', 'Tool', 'Trainer', 'Mind Map', 'Other'];
                typeOrder.forEach(typeKey => {
                    const subFiles = typeSubgroups[typeKey];
                    if (!subFiles || subFiles.length === 0) return;

                    let typeLabel = typeKey;
                    if (typeKey === 'Flow Chart') typeLabel = 'Flow Charts';
                    if (typeKey === 'Slide Deck') typeLabel = 'Slide Decks';
                    if (typeKey === 'Video') typeLabel = 'Videos';
                    if (typeKey === 'Demonstration') typeLabel = 'Demonstrations';
                    if (typeKey === 'Tool') typeLabel = 'Interactive Tools';
                    if (typeKey === 'Trainer') typeLabel = 'Trainers';
                    if (typeKey === 'Mind Map') typeLabel = 'Mind Maps';
                    if (typeKey === 'Discussion') typeLabel = 'Discussions';

                    html += `
                        <div style="margin-top: 10px; margin-bottom: 6px; font-size: 0.775rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; padding-left: 6px;">
                            ${escapeHtml(typeLabel)} (${subFiles.length})
                        </div>
                    `;

                    subFiles.forEach(file => {
                        let badgeClass = 'badge-doc';
                        if (file.type === 'Flow Chart') badgeClass = 'badge-flowchart';
                        if (file.type === 'Slide Deck') badgeClass = 'badge-pdf';
                        if (file.type === 'Video') badgeClass = 'badge-video';
                        if (file.type === 'Demonstration') badgeClass = 'badge-demo';
                        if (file.type === 'Tool') badgeClass = 'badge-tool';
                        if (file.type === 'Trainer') badgeClass = 'badge-trainer';
                        if (file.type === 'Mind Map') badgeClass = 'badge-map';

                        const displayTitle = cleanDisplayTitle(file.title, file.name);
                        const cardDomId = 'card-' + file.name.replace(/[^a-zA-Z0-9_-]/g, '_');
                        const badgeLabel = getBadgeLabel(file);

                        const mindMapHref = file.type === 'Mind Map' ? getMindMapUrlWithStats(file.path) : file.path;
                        html += `
                            <div class="tree-item" id="${cardDomId}" onclick="openPreview('${encodeURIComponent(file.path)}', '${escapeJsString(displayTitle)}')">
                                <div class="tree-item-left">
                                    <span class="card-badge ${badgeClass}" style="padding: 2px 8px; font-size: 0.7rem;">${badgeLabel}</span>
                                    <span class="tree-item-name">${escapeHtml(displayTitle)}</span>
                                </div>
                                <div class="tree-item-actions">
                                    <button class="btn btn-preview" style="padding: 4px 10px; font-size: 0.775rem;" onclick="openPreview('${encodeURIComponent(file.path)}', '${escapeJsString(displayTitle)}'); event.stopPropagation();">Preview</button>
                                    <a class="btn btn-open" style="padding: 4px 10px; font-size: 0.775rem;" href="${encodeURI(mindMapHref)}" target="_blank" rel="opener" onclick="event.stopPropagation();">Open ↗</a>
                                    <button class="btn btn-share btn-icon-only" style="padding: 4px; width: 28px; height: 28px;" title="Copy shareable link" onclick="copyShareLink('${escapeJsString(file.name)}'); event.stopPropagation();">
                                        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        `;
                    });
                });

                html += `
                        </div>
                    </div>
                `;
            });
        });
    });

    html += `</div>`;
    container.innerHTML = html;
}

// Copy Shareable Link Helper
function copyShareLink(filename) {
    const cleanId = 'card-' + filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    const shareUrl = window.location.origin + window.location.pathname + '#' + cleanId;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            showToast('Shareable link copied to clipboard!');
        }).catch(() => {
            fallbackCopyText(shareUrl);
        });
    } else {
        fallbackCopyText(shareUrl);
    }
}

function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showToast('Shareable link copied to clipboard!');
    } catch (err) {
        console.error('Copy fallback failed:', err);
    }
    document.body.removeChild(textArea);
}

// Toast notification helper
function showToast(msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `
        <svg width="18" height="18" fill="none" stroke="#EFE1CE" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span>${escapeHtml(msg)}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3100);
}

let isInitialHashCheck = true;
let highlightTimeout = null;

// Smooth scroll & pulse highlight when hash URL is visited
function checkUrlHashTarget() {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#card-')) return;
    const cleanId = hash.substring(1); // remove '#'
    
    // Ensure targeted card is rendered by resetting filter, section & search if needed
    if (filesData && Array.isArray(filesData)) {
        const targetFile = filesData.find(f => ('card-' + f.name.replace(/[^a-zA-Z0-9_-]/g, '_')) === cleanId);
        if (targetFile) {
            let needReRender = false;
            const targetDomain = getDomainKey(targetFile);

            if (currentSection !== 'all' && currentSection !== targetDomain) {
                currentSection = 'all';
                const sectionTabs = document.querySelectorAll('.section-tab');
                sectionTabs.forEach(t => {
                    if (t.getAttribute('data-section') === 'all') t.classList.add('active');
                    else t.classList.remove('active');
                });
                needReRender = true;
            }

            if (currentFilter !== 'all') {
                currentFilter = 'all';
                const chips = document.querySelectorAll('.chip');
                chips.forEach(c => {
                    if (c.getAttribute('data-filter') === 'all') c.classList.add('active');
                    else c.classList.remove('active');
                });
                needReRender = true;
            }

            if (currentSearch) {
                currentSearch = '';
                const searchInput = document.getElementById('searchInput');
                if (searchInput) searchInput.value = '';
                needReRender = true;
            }

            if (needReRender) {
                updateCategoryCounts();
                render();
            }
        }
    }

    const delay = isInitialHashCheck ? 650 : 150;
    
    if (isInitialHashCheck) {
        window.scrollTo(0, 0);
    }

    setTimeout(() => {
        const targetEl = document.getElementById(cleanId);
        const container = document.getElementById('contentContainer');

        if (targetEl && container) {
            if (highlightTimeout) clearTimeout(highlightTimeout);

            // Remove any previous persistent highlight
            document.querySelectorAll('.card-persistent-highlight').forEach(el => {
                el.classList.remove('card-persistent-highlight');
            });

            // Dim all non-selected cards
            document.body.classList.add('has-card-highlight');
            container.classList.add('has-card-highlight');

            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetEl.classList.add('card-persistent-highlight');

            highlightTimeout = setTimeout(() => {
                document.body.classList.remove('has-card-highlight');
                container.classList.remove('has-card-highlight');
            }, 1500);

            const clearHighlight = () => {
                targetEl.classList.remove('card-persistent-highlight');
                document.body.classList.remove('has-card-highlight');
                container.classList.remove('has-card-highlight');
                targetEl.removeEventListener('mouseenter', clearHighlight);
                targetEl.removeEventListener('click', clearHighlight);
            };

            targetEl.addEventListener('mouseenter', clearHighlight, { once: true });
            targetEl.addEventListener('click', clearHighlight, { once: true });

            // Clean hash from address bar without page reload
            try {
                if (window.history && window.history.replaceState) {
                    const cleanUrl = window.location.pathname + window.location.search;
                    window.history.replaceState(null, document.title, cleanUrl);
                }
            } catch (e) {
                // Ignore potential sandbox/security restrictions
            }
        }
        isInitialHashCheck = false;
    }, delay);
}

// Helper: Extract YouTube Video ID
function getYouTubeId(url) {
    if (!url || typeof url !== 'string') return null;
    url = url.trim();
    if (url.includes('PLACEHOLDER')) return null;

    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
        return url;
    }

    const regExp = /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[1] && match[1].length === 11) ? match[1] : null;
}

// Modal Viewport Controller
function openPreview(encodedPath, title) {
    const rawPath = decodeURIComponent(encodedPath);
    const path = getMindMapUrlWithStats(rawPath);
    const modalBackdrop = document.getElementById('modalBackdrop');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.querySelector('.modal-body');
    const modalExternalLink = document.getElementById('modalExternalLink');

    modalTitle.textContent = title;
    modalExternalLink.href = path;

    const ytId = getYouTubeId(path);

    // 1. YouTube Video Preview
    if (ytId || path.includes('youtube.com') || path.includes('youtu.be') || path.includes('PLACEHOLDER')) {
        if (ytId) {
            modalBody.innerHTML = `
                <iframe src="https://www.youtube.com/embed/${ytId}?autoplay=1" width="100%" height="100%" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="${escapeHtml(title)}"></iframe>
            `;
        } else {
            modalBody.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:24px; text-align:center; color: var(--text-primary);">
                    <svg width="64" height="64" fill="none" stroke="#DC2626" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <h3 style="margin-top:16px; margin-bottom:8px; font-size: 1.2rem;">YouTube Video Link Placeholder</h3>
                    <p style="color:var(--text-secondary); max-width:480px; font-size: 0.9rem; line-height: 1.5;">To connect this video, open <code>video_links.json</code> in your project directory, replace <code>PLACEHOLDER</code> with your YouTube URL, and run <code>python generate_index.py</code>.</p>
                </div>
            `;
        }
    } 
    // 2. PDF Slide Deck Preview
    else if (path.toLowerCase().endsWith('.pdf')) {
        modalBody.innerHTML = `
            <object data="${path}#toolbar=0&navpanes=0&view=FitH" type="application/pdf" width="100%" height="100%">
                <iframe src="${path}" width="100%" height="100%" frameborder="0">
                    <p>Your browser does not support inline PDF preview. <a href="${path}" target="_blank">Click here to open PDF</a>.</p>
                </iframe>
            </object>
        `;
    } 
    // 3. HTML Document Preview
    else {
        modalBody.innerHTML = `<iframe id="modalIframe" src="${path}" width="100%" height="100%" frameborder="0" title="Resource Preview"></iframe>`;
    }

    modalBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modalBackdrop = document.getElementById('modalBackdrop');
    const modalBody = document.querySelector('.modal-body');

    modalBackdrop.classList.remove('active');
    modalBody.innerHTML = '';
    document.body.style.overflow = '';
}

// Helper utilities
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeJsString(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}
