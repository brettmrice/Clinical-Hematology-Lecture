let filesData = [];
let currentFilter = 'all';
let currentSearch = '';
let currentView = 'grid'; // 'grid' or 'tree'

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

// Setup Event Listeners
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value.toLowerCase().trim();
            render();
        });
    }

    // Theme Toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }

    // Filter Chips
    const chips = document.querySelectorAll('.chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.getAttribute('data-filter');
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

// Count items for chips
function updateCategoryCounts() {
    const countAll = filesData.length;
    const countDisc = filesData.filter(f => f.type === 'Discussion').length;
    const countPdf = filesData.filter(f => f.type === 'Slide Deck').length;
    const countVideo = filesData.filter(f => f.type === 'Video').length;
    const countMaps = filesData.filter(f => f.type === 'Mind Map').length;

    document.getElementById('countAll').textContent = countAll;
    document.getElementById('countDisc').textContent = countDisc;
    document.getElementById('countPdf').textContent = countPdf;
    if (document.getElementById('countVideo')) {
        document.getElementById('countVideo').textContent = countVideo;
    }
    document.getElementById('countMaps').textContent = countMaps;
}

// Filter logic
function getFilteredFiles() {
    const filtered = filesData.filter(file => {
        // Filter chip
        if (currentFilter === 'discussion' && file.type !== 'Discussion') return false;
        if (currentFilter === 'pdf' && file.type !== 'Slide Deck') return false;
        if (currentFilter === 'video' && file.type !== 'Video') return false;
        if (currentFilter === 'mindmap' && file.type !== 'Mind Map') return false;

        // Search text
        if (currentSearch) {
            const matchName = file.name.toLowerCase().includes(currentSearch);
            const matchTitle = (file.title || '').toLowerCase().includes(currentSearch);
            const matchCat = file.category.toLowerCase().includes(currentSearch);
            const matchType = file.type.toLowerCase().includes(currentSearch);
            return matchName || matchTitle || matchCat || matchType;
        }

        return true;
    });

    // Sort cards in the exact same order as original file names
    return filtered.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
}

// Main Render Function
function render() {
    const container = document.getElementById('contentContainer');
    const filtered = getFilteredFiles();

    document.getElementById('resultsStats').textContent = `Showing ${filtered.length} of ${filesData.length} files`;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3>No matching files found</h3>
                <p>Try adjusting your search terms or filter criteria.</p>
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

// Render Card Grid
function renderCardGrid(container, files) {
    // 1. Group files by L# prefix
    const topicGroups = {};
    files.forEach(file => {
        const match = file.name.match(/^(L\d+)/i);
        const groupKey = match ? match[1].toUpperCase() : 'Other';
        if (!topicGroups[groupKey]) topicGroups[groupKey] = [];
        topicGroups[groupKey].push(file);
    });

    const topicTitles = {
        'L1': 'Hematopoiesis',
        'L2': 'Erythrocytes & Hemoglobin',
        'L3': 'Leukocytes & Platelets',
        'L4': 'RBC Analysis'
    };

    let html = '';
    for (const groupKey in topicGroups) {
        if (!topicTitles[groupKey]) continue; // Skip General Resources / untagged sections
        const topicFiles = topicGroups[groupKey];
        const sectionTitle = topicTitles[groupKey];

        // 2. Separate topicFiles into sub-rows by type
        const typeSubgroups = {
            'Discussion': [],
            'Slide Deck': [],
            'Video': [],
            'Mind Map': []
        };

        topicFiles.forEach(file => {
            if (typeSubgroups[file.type]) {
                typeSubgroups[file.type].push(file);
            } else {
                if (!typeSubgroups['Other']) typeSubgroups['Other'] = [];
                typeSubgroups['Other'].push(file);
            }
        });

        html += `
            <div class="section-group">
                <div class="section-title">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                    </svg>
                    ${escapeHtml(sectionTitle)} (${topicFiles.length})
                </div>
        `;

        const typeOrder = ['Discussion', 'Slide Deck', 'Video', 'Mind Map', 'Other'];
        typeOrder.forEach(typeKey => {
            const subFiles = typeSubgroups[typeKey];
            if (!subFiles || subFiles.length === 0) return;

            let typeLabel = typeKey;
            if (typeKey === 'Slide Deck') typeLabel = 'Slide Decks';
            if (typeKey === 'Video') typeLabel = 'Videos';
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
                if (file.type === 'Slide Deck') badgeClass = 'badge-pdf';
                if (file.type === 'Video') badgeClass = 'badge-video';
                if (file.type === 'Mind Map') badgeClass = 'badge-map';

                const displayTitle = file.title || file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
                const cardDomId = 'card-' + file.name.replace(/[^a-zA-Z0-9_-]/g, '_');

                html += `
                    <div class="card" id="${cardDomId}" onclick="openPreview('${encodeURIComponent(file.path)}', '${escapeJsString(displayTitle)}')">
                        <div>
                            <div class="card-header">
                                <span class="card-badge ${badgeClass}">${file.type}</span>
                                <span class="card-category">${file.category}</span>
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
                            <a class="btn btn-open" href="${encodeURI(file.path)}" target="_blank" rel="noopener noreferrer" title="Open in new tab" onclick="event.stopPropagation();">
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

        html += `</div>`;
    }
    container.innerHTML = html;
}

// Render Directory Tree
function renderTree(container, files) {
    // 1. Group files by L# prefix
    const topicGroups = {};
    files.forEach(file => {
        const match = file.name.match(/^(L\d+)/i);
        const groupKey = match ? match[1].toUpperCase() : 'Other';
        if (!topicGroups[groupKey]) topicGroups[groupKey] = [];
        topicGroups[groupKey].push(file);
    });

    const topicTitles = {
        'L1': 'Hematopoiesis',
        'L2': 'Erythrocytes & Hemoglobin',
        'L3': 'Leukocytes & Platelets',
        'L4': 'RBC Analysis'
    };

    let html = `<div class="tree-view">`;
    for (const groupKey in topicGroups) {
        if (!topicTitles[groupKey]) continue; // Skip General Resources / untagged sections
        const topicFiles = topicGroups[groupKey];
        const sectionTitle = topicTitles[groupKey];

        // 2. Separate into type subgroups
        const typeSubgroups = {
            'Discussion': [],
            'Slide Deck': [],
            'Video': [],
            'Mind Map': []
        };

        topicFiles.forEach(file => {
            if (typeSubgroups[file.type]) {
                typeSubgroups[file.type].push(file);
            } else {
                if (!typeSubgroups['Other']) typeSubgroups['Other'] = [];
                typeSubgroups['Other'].push(file);
            }
        });

        html += `
            <div class="tree-folder" style="margin-bottom: 24px;">
                <div class="tree-folder-title">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                    </svg>
                    ${escapeHtml(sectionTitle)} (${topicFiles.length})
                </div>
                <div class="tree-folder-items" style="padding-left: 8px;">
        `;

        const typeOrder = ['Discussion', 'Slide Deck', 'Video', 'Mind Map', 'Other'];
        typeOrder.forEach(typeKey => {
            const subFiles = typeSubgroups[typeKey];
            if (!subFiles || subFiles.length === 0) return;

            let typeLabel = typeKey;
            if (typeKey === 'Slide Deck') typeLabel = 'Slide Decks';
            if (typeKey === 'Video') typeLabel = 'Videos';
            if (typeKey === 'Mind Map') typeLabel = 'Mind Maps';
            if (typeKey === 'Discussion') typeLabel = 'Discussions';

            html += `
                <div style="margin-top: 10px; margin-bottom: 6px; font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; padding-left: 6px;">
                    ${escapeHtml(typeLabel)} (${subFiles.length})
                </div>
            `;

            subFiles.forEach(file => {
                let badgeClass = 'badge-doc';
                if (file.type === 'Slide Deck') badgeClass = 'badge-pdf';
                if (file.type === 'Video') badgeClass = 'badge-video';
                if (file.type === 'Mind Map') badgeClass = 'badge-map';

                const displayTitle = file.title || file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
                const cardDomId = 'card-' + file.name.replace(/[^a-zA-Z0-9_-]/g, '_');

                html += `
                    <div class="tree-item" id="${cardDomId}" onclick="openPreview('${encodeURIComponent(file.path)}', '${escapeJsString(displayTitle)}')">
                        <div class="tree-item-left">
                            <span class="card-badge ${badgeClass}" style="padding: 2px 8px; font-size: 0.7rem;">${file.type}</span>
                            <span class="tree-item-name">${escapeHtml(displayTitle)}</span>
                        </div>
                        <div class="tree-item-actions">
                            <button class="btn btn-preview" style="padding: 4px 10px; font-size: 0.775rem;" onclick="openPreview('${encodeURIComponent(file.path)}', '${escapeJsString(displayTitle)}'); event.stopPropagation();">Preview</button>
                            <a class="btn btn-open" style="padding: 4px 10px; font-size: 0.775rem;" href="${encodeURI(file.path)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">Open ↗</a>
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
    }
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
let pulseCleanTimeout = null;

// Smooth scroll & pulse highlight when hash URL is visited
function checkUrlHashTarget() {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#card-')) return;
    const cleanId = hash.substring(1); // remove '#'
    
    // Ensure targeted card is rendered by resetting filter & search if needed
    if (filesData && Array.isArray(filesData)) {
        const targetFile = filesData.find(f => ('card-' + f.name.replace(/[^a-zA-Z0-9_-]/g, '_')) === cleanId);
        if (targetFile) {
            let needReRender = false;
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
                render();
            }
        }
    }

    const delay = isInitialHashCheck ? 650 : 150;
    
    if (isInitialHashCheck) {
        // Ensure browser starts at very top on initial load
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

            // Non-selected cards start 3.0s smooth fade-back at 1500ms (reaching 100% opacity at 4.5s)
            highlightTimeout = setTimeout(() => {
                document.body.classList.remove('has-card-highlight');
                container.classList.remove('has-card-highlight');
            }, 1500);

            // Clear persistent highlight when user hovers over or clicks the targeted card
            const clearHighlight = () => {
                targetEl.classList.remove('card-persistent-highlight');
                document.body.classList.remove('has-card-highlight');
                container.classList.remove('has-card-highlight');
                targetEl.removeEventListener('mouseenter', clearHighlight);
                targetEl.removeEventListener('click', clearHighlight);
            };

            targetEl.addEventListener('mouseenter', clearHighlight, { once: true });
            targetEl.addEventListener('click', clearHighlight, { once: true });
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
    const path = decodeURIComponent(encodedPath);
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
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeJsString(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}
