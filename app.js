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
}

// Count items for chips
function updateCategoryCounts() {
    const countAll = filesData.length;
    const countMaps = filesData.filter(f => f.type === 'Mind Map').length;
    const countDisc = filesData.filter(f => f.type === 'Discussion').length;
    const countPdf = filesData.filter(f => f.type === 'PDF Slide').length;

    document.getElementById('countAll').textContent = countAll;
    document.getElementById('countMaps').textContent = countMaps;
    document.getElementById('countDisc').textContent = countDisc;
    document.getElementById('countPdf').textContent = countPdf;
}

// Filter logic
function getFilteredFiles() {
    return filesData.filter(file => {
        // Filter chip
        if (currentFilter === 'mindmap' && file.type !== 'Mind Map') return false;
        if (currentFilter === 'discussion' && file.type !== 'Discussion') return false;
        if (currentFilter === 'pdf' && file.type !== 'PDF Slide') return false;

        // Search text
        if (currentSearch) {
            const matchName = file.name.toLowerCase().includes(currentSearch);
            const matchCat = file.category.toLowerCase().includes(currentSearch);
            const matchType = file.type.toLowerCase().includes(currentSearch);
            return matchName || matchCat || matchType;
        }

        return true;
    });
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
}

// Render Card Grid
function renderCardGrid(container, files) {
    let html = `<div class="grid-view">`;
    files.forEach(file => {
        let badgeClass = 'badge-doc';
        if (file.type === 'PDF Slide') badgeClass = 'badge-pdf';
        if (file.type === 'Mind Map') badgeClass = 'badge-map';

        const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");

        html += `
            <div class="card">
                <div>
                    <div class="card-header">
                        <span class="card-badge ${badgeClass}">${file.type}</span>
                        <span class="card-category">${file.category}</span>
                    </div>
                    <div class="card-title">${escapeHtml(cleanTitle)}</div>
                    <div class="card-meta">
                        <span>📁 ${escapeHtml(file.name)}</span>
                        <span>•</span>
                        <span>${file.sizeFormatted}</span>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn btn-primary" onclick="openPreview('${encodeURIComponent(file.path)}', '${escapeJsString(cleanTitle)}')">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                        Preview
                    </button>
                    <a class="btn" href="${encodeURI(file.path)}" target="_blank" rel="noopener noreferrer" title="Open in new tab">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                        Open
                    </a>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    container.innerHTML = html;
}

// Render Directory Tree
function renderTree(container, files) {
    // Group files by category
    const grouped = {};
    files.forEach(file => {
        if (!grouped[file.category]) grouped[file.category] = [];
        grouped[file.category].push(file);
    });

    let html = `<div class="tree-view">`;
    for (const category in grouped) {
        html += `
            <div class="tree-folder">
                <div class="tree-folder-title">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                    </svg>
                    ${escapeHtml(category)} (${grouped[category].length})
                </div>
                <div class="tree-folder-items">
        `;

        grouped[category].forEach(file => {
            const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
            html += `
                <div class="tree-item">
                    <div class="tree-item-left">
                        <span class="tree-item-name">${escapeHtml(cleanTitle)}</span>
                        <span style="font-size: 0.75rem; color: var(--text-secondary);">(${file.type} • ${file.sizeFormatted})</span>
                    </div>
                    <div class="tree-item-actions">
                        <button class="btn btn-primary" style="padding: 4px 10px; font-size: 0.775rem;" onclick="openPreview('${encodeURIComponent(file.path)}', '${escapeJsString(cleanTitle)}')">Preview</button>
                        <a class="btn" style="padding: 4px 10px; font-size: 0.775rem;" href="${encodeURI(file.path)}" target="_blank" rel="noopener">Open ↗</a>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    }
    html += `</div>`;
    container.innerHTML = html;
}

// Modal Viewport Controller
function openPreview(encodedPath, title) {
    const path = decodeURIComponent(encodedPath);
    const modalBackdrop = document.getElementById('modalBackdrop');
    const modalTitle = document.getElementById('modalTitle');
    const modalIframe = document.getElementById('modalIframe');
    const modalExternalLink = document.getElementById('modalExternalLink');

    modalTitle.textContent = title;
    modalIframe.src = path;
    modalExternalLink.href = path;

    modalBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modalBackdrop = document.getElementById('modalBackdrop');
    const modalIframe = document.getElementById('modalIframe');

    modalBackdrop.classList.remove('active');
    modalIframe.src = 'about:blank';
    document.body.style.overflow = '';
}

// Helper utilities
function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeJsString(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}
