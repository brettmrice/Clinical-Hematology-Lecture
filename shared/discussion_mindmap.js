/**
 * Portable Discussion Mind Map Overlay & Knowledge Processing Engine
 * Synchronizes discussion navigation and header controls with companion Mind Maps.
 */

(function () {
    'use strict';

    let companionMindMapFilename = '';

    // Direct mapping dictionary for 100% immediate zero-latency resolution
    const DIRECT_MINDMAP_MAP = {
        'l1_manual_counts': 'L1_Manual_Counts_S3_Mind_Map.html',
        'l2_slide_preparation': 'L2_Slide_Preparation_S2_Mind_Map.html',
        'l3_slide_evaluation': 'L3_Slide_Evaluation_S3_Mind_Map.html',
        'l4_cbc_analysis': 'L4_CBC_Analysis_S3_Mind_Map.html',
        'l5_microcytic': 'L5_Microcytic_S1_Mind_Map.html',
        'l6_hemoglobinopathy': 'L6_Hemoglobinopathy_S1_Mind_Map.html',
        'l7_macrocytic': 'L7_Macrocytic_S1_Mind_Map.html',
        'l8_normocytic': 'L8_Normocytic_S1_Mind_Map.html',
        'l9_benign': 'L9_Benign_S1_Mind_Map.html',
        'l10_aml': 'L10_AML_S1_Mind_Map.html',
        'l11_mpn_mds': 'L11_MPN_MDS_S1_Mind_Map.html',
        'l12_lacln': 'L12_LACLN_S1_Mind_Map.html',
        'l12_all': 'L12_ALL_S1_Mind_Map.html',
        'l13_bm_flow': 'L13_BM_Flow_S1_Mind_Map.html',
        'l1_hematopoiesis': 'L1_Hematopoiesis_S4_Mind_Map.html',
        'l2_bce_rbc-hgb': 'L2_BCE_RBC-HGB_S3_Mind_Map.html',
        'l3_bce_wbc-plt': 'L3_BCE_WBC-PLT_S4_Mind_Map.html',
        'l4_rbc_analysis': 'L4_RBC_Analysis_S4_Mind_Map.html',
        'l5_iron_heme': 'L5_Iron_Heme_S1_Mind_Map.html',
        'l7_macros_hypos': 'L7_Macros_Hypos_S4_Mind_Map.html',
        'l8_hemolytic': 'L8_Hemolytic_S1_Mind_Map.html'
    };

    // Determine candidate lookup keys from URL/path
    function getLookupKeys() {
        const path = decodeURIComponent(window.location.pathname).replace(/\\/g, '/');
        const parts = path.split('/').filter(Boolean);
        const filename = parts.pop() || '';
        const rawName = filename.replace(/\.html$/i, '');
        
        let folder = '';
        let subfolder = '';

        for (let i = 0; i < parts.length; i++) {
            const p = parts[i].toLowerCase();
            if (p === 'lecture' || p === 'laboratory') {
                folder = p;
                if (i + 1 < parts.length) {
                    subfolder = parts[i + 1].toLowerCase();
                }
                break;
            }
        }

        // Clean lesson key: strip _Discussion, __Discussion, _S0_, etc.
        const cleaned = rawName.replace(/_{1,2}Discussion/i, '').replace(/_S\d+$/i, '').toLowerCase();
        const match = rawName.match(/^(L\d+_[^_]+(?:_[^_]+)*?)(?:_S\d+)?(?:_{1,2}Discussion|_Mind_Map)?$/i);
        const lessonKey = match ? match[1].toLowerCase() : cleaned;

        const candidates = [];
        if (folder && subfolder) candidates.push(`${folder}/${subfolder}/${lessonKey}`);
        if (folder) candidates.push(`${folder}/${lessonKey}`);
        candidates.push(lessonKey);
        candidates.push(cleaned);
        candidates.push(rawName.toLowerCase());

        return candidates;
    }

    // Resolve relative path to shared assets
    function getSharedPath() {
        const scripts = document.querySelectorAll('script[src]');
        for (const s of scripts) {
            const src = s.getAttribute('src') || '';
            if (src.includes('discussion_mindmap.js') || src.includes('mindmaps_manifest.js') || src.includes('discussion_quiz.js')) {
                const idx = src.lastIndexOf('/');
                if (idx !== -1) return src.substring(0, idx);
            }
        }
        const path = decodeURIComponent(window.location.pathname).replace(/\\/g, '/').toLowerCase();
        if (path.includes('/lecture/') || path.includes('/laboratory/')) {
            return '../../shared';
        }
        return './shared';
    }

    // Auto-inject CSS stylesheet and dynamic card offset styles if not present
    function ensureCSS() {
        const existing = document.querySelector('link[href*="discussion_mindmap.css"]');
        if (!existing) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `${getSharedPath()}/discussion_mindmap.css?v=20261007b`;
            document.head.appendChild(link);
        }

        // Dynamically enforce sticky bottom offset for interactive cards in mobile/centered view
        if (!document.getElementById('chgh-sticky-card-dock-fix')) {
            const style = document.createElement('style');
            style.id = 'chgh-sticky-card-dock-fix';
            style.textContent = `
                @media (max-width: 768px) {
                    :root {
                        --card-sticky-bottom: calc(max(16px, env(safe-area-inset-bottom, 16px)) + 52px) !important;
                    }
                    html body .flowchart-wrapper:not(.is-collapsed) .flowchart-header-card,
                    html body .flowchart-wrapper:not(.is-collapsed) .flowchart-preview-card,
                    html body .table-wrapper:not(.is-collapsed) .table-header-card,
                    html body .table-wrapper:not(.is-collapsed) .table-preview-card,
                    html body .formula-wrapper:not(.is-collapsed) .formula-header-card,
                    html body .formula-wrapper:not(.is-collapsed) .formula-preview-card,
                    html body .graphic-wrapper:not(.is-collapsed) .graphic-header-card,
                    html body .graphic-wrapper:not(.is-collapsed) .graphic-preview-card {
                        bottom: calc(max(16px, env(safe-area-inset-bottom, 16px)) + 52px) !important;
                        transition: bottom 0.25s ease !important;
                    }
                }
            `;
            if (document.head) {
                document.head.appendChild(style);
            } else {
                document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
            }
        }
    }

    // Ensure manifest data is loaded if needed
    function ensureMindMapData(callback) {
        if (window.COURSE_MINDMAPS && Array.isArray(window.COURSE_MINDMAPS)) {
            callback(window.COURSE_MINDMAPS);
            return;
        }
        if (window.COURSE_MINDMAPS_DATA) {
            callback(window.COURSE_MINDMAPS_DATA);
            return;
        }

        const script = document.createElement('script');
        script.src = `${getSharedPath()}/mindmaps_manifest.js?v=20261007`;
        script.onload = () => {
            callback(window.COURSE_MINDMAPS || window.COURSE_MINDMAPS_DATA || []);
        };
        script.onerror = () => {
            callback([]);
        };
        document.head.appendChild(script);
    }

    // Synchronously resolve companion filename
    function resolveCompanionFilename(allMindMaps) {
        const candidates = getLookupKeys();

        // 1. Direct map check
        for (const cand of candidates) {
            const normalized = cand.split('/').pop();
            if (DIRECT_MINDMAP_MAP[normalized]) {
                return DIRECT_MINDMAP_MAP[normalized];
            }
        }

        // 2. Check COURSE_MINDMAPS array (from mindmaps_manifest.js)
        if (Array.isArray(allMindMaps)) {
            for (const cand of candidates) {
                const candNorm = cand.replace(/[^a-z0-9]/g, '');
                const found = allMindMaps.find(m => {
                    const idNorm = (m.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const fileNorm = (m.filename || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    return idNorm.includes(candNorm) || fileNorm.includes(candNorm) || candNorm.includes(idNorm);
                });
                if (found && found.filename) {
                    return found.filename;
                }
            }
        } else if (allMindMaps && typeof allMindMaps === 'object') {
            // 3. Check COURSE_MINDMAPS_DATA object if present
            for (const key of candidates) {
                if (allMindMaps[key] && allMindMaps[key].file) {
                    return allMindMaps[key].file.split('/').pop();
                }
            }
            const keys = Object.keys(allMindMaps);
            for (const cand of candidates) {
                const found = keys.find(k => k.toLowerCase() === cand || k.toLowerCase().includes(cand));
                if (found && allMindMaps[found] && allMindMaps[found].file) {
                    return allMindMaps[found].file.split('/').pop();
                }
            }
        }

        // 4. Clean filename fallback
        const currentFile = decodeURIComponent(window.location.pathname).replace(/\\/g, '/').split('/').pop() || '';
        const base = currentFile.replace(/_S\d+_{1,2}Discussion\.html|_Discussion\.html/i, '');
        if (base) {
            return `${base}_S1_Mind_Map.html`;
        }

        return 'index.html';
    }

    // Initial immediate sync resolution
    companionMindMapFilename = resolveCompanionFilename(window.COURSE_MINDMAPS || window.COURSE_MINDMAPS_DATA || null);

    // Helper to obtain or build shared FAB dock container
    function getOrCreateFabDock() {
        let dock = document.getElementById('discussion-fab-dock');
        if (!dock) {
            dock = document.createElement('div');
            dock.id = 'discussion-fab-dock';
            dock.className = 'discussion-fab-dock';
            dock.setAttribute('role', 'toolbar');
            dock.setAttribute('aria-label', 'Discussion Navigation and Quick Actions');
            document.body.appendChild(dock);
        }
        return dock;
    }

    // Build DOM elements (Pill Button linking directly to companion Mind Map in new tab)
    function injectOverlayDOM() {
        if (!document.body) {
            window.addEventListener('DOMContentLoaded', injectOverlayDOM);
            return;
        }

        ensureCSS();
        const dock = getOrCreateFabDock();

        // Enhance jump-to-nav-btn with SVG icon if present and adopt into dock
        const jumpNavBtn = document.getElementById('jump-to-nav-btn');
        if (jumpNavBtn) {
            if (!jumpNavBtn.querySelector('svg')) {
                const text = jumpNavBtn.textContent.trim() || 'Navigation';
                jumpNavBtn.setAttribute('title', 'Jump to Course Navigation');
                jumpNavBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="fab-icon"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg><span class="fab-text">${escapeHtml(text)}</span>`;
            }
            if (jumpNavBtn.parentElement !== dock) {
                dock.appendChild(jumpNavBtn);
            }
        }

        if (document.getElementById('discussion-mindmap-fab')) return;

        // Floating Action Button (FAB)
        const fab = document.createElement('a');
        fab.id = 'discussion-mindmap-fab';
        fab.className = 'discussion-mindmap-fab';
        fab.setAttribute('title', 'Open Full Concept Mind Map in new tab');
        fab.setAttribute('aria-label', 'Open Full Concept Mind Map in new tab');
        fab.setAttribute('target', '_blank');
        fab.setAttribute('rel', 'noopener noreferrer');
        fab.href = companionMindMapFilename || '#';
        fab.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="fab-icon"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg><span class="fab-text">Mind Map</span>`;
        
        if (jumpNavBtn && jumpNavBtn.parentElement === dock) {
            dock.insertBefore(fab, jumpNavBtn);
        } else {
            dock.appendChild(fab);
        }

        fab.addEventListener('click', (e) => {
            if (!companionMindMapFilename || companionMindMapFilename === '#') {
                companionMindMapFilename = resolveCompanionFilename(window.COURSE_MINDMAPS || null);
            }
            if (companionMindMapFilename && companionMindMapFilename !== '#') {
                fab.href = companionMindMapFilename;
            }
        });
    }

    // Visibility observer directly synchronizing with navigation button
    function initVisibilityObserver() {
        const fab = document.getElementById('discussion-mindmap-fab');
        if (!fab) return;

        const navBtn = document.getElementById('jump-to-nav-btn');
        if (navBtn) {
            const syncWithNavBtn = () => {
                if (navBtn.classList.contains('visible')) {
                    fab.classList.add('visible');
                } else {
                    fab.classList.remove('visible');
                }
            };

            syncWithNavBtn();

            if (typeof MutationObserver !== 'undefined') {
                const observer = new MutationObserver((mutations) => {
                    for (const m of mutations) {
                        if (m.type === 'attributes' && m.attributeName === 'class') {
                            syncWithNavBtn();
                        }
                    }
                });
                observer.observe(navBtn, { attributes: true, attributeFilter: ['class'] });
            }

            window.addEventListener('scroll', syncWithNavBtn, { passive: true });
            return;
        }

        // Fallback: direct IntersectionObserver on #navigation if navBtn missing
        const navElement = document.getElementById('navigation');
        if (navElement && typeof IntersectionObserver !== 'undefined') {
            const navObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        fab.classList.remove('visible');
                    } else {
                        fab.classList.add('visible');
                    }
                });
            }, {
                root: null,
                threshold: 0
            });
            navObserver.observe(navElement);
        } else {
            const updateVisibility = () => {
                if (window.scrollY > 200) {
                    fab.classList.add('visible');
                } else {
                    fab.classList.remove('visible');
                }
            };
            window.addEventListener('scroll', updateVisibility, { passive: true });
            window.addEventListener('resize', updateVisibility);
            updateVisibility();
        }
    }

    // HTML escape utility
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Extract title & subtitle from first H1 header in markdown or document title
    function getDiscussionTitleInfo() {
        const firstH1 = document.querySelector('.markdown-body h1, h1');
        let title = '';
        let subtitle = 'Complete Discussion';

        if (firstH1) {
            const fullText = firstH1.textContent.trim();
            if (fullText.includes('|')) {
                const parts = fullText.split('|').map(s => s.trim());
                title = parts[0];
                subtitle = parts[1] || 'Complete Discussion';
            } else if (fullText.includes(' - ')) {
                const parts = fullText.split(' - ').map(s => s.trim());
                title = parts[0];
                subtitle = parts[1] || 'Complete Discussion';
            } else {
                title = fullText;
                subtitle = 'Clinical Hematology Discussion';
            }
        }

        if (!title) {
            const docTitle = (document.title || 'Clinical Hematology').replace(/\s*\|\s*Complete Discussion.*/i, '').trim();
            title = docTitle || 'Clinical Hematology';
        }

        return { title, subtitle };
    }

    // Manage light / dark theme synchronized with index.html localStorage
    function initThemeToggle() {
        const savedTheme = localStorage.getItem('chgh_theme') || 
            (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

        function applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            document.documentElement.setAttribute('data-color-mode', theme);
            if (document.body) {
                document.body.setAttribute('data-theme', theme);
            }
            localStorage.setItem('chgh_theme', theme);
            updateToggleIcon(theme);
        }

        function updateToggleIcon(theme) {
            const btn = document.getElementById('discussionThemeToggleBtn');
            if (!btn) return;
            if (theme === 'dark') {
                btn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="5"></circle>
                        <line x1="12" y1="1" x2="12" y2="3"></line>
                        <line x1="12" y1="21" x2="12" y2="23"></line>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                        <line x1="1" y1="12" x2="3" y2="12"></line>
                        <line x1="21" y1="12" x2="23" y2="12"></line>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                    </svg>`;
                btn.setAttribute('title', 'Switch to Light Mode');
                btn.setAttribute('aria-label', 'Switch to Light Mode');
            } else {
                btn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                    </svg>`;
                btn.setAttribute('title', 'Switch to Dark Mode');
                btn.setAttribute('aria-label', 'Switch to Dark Mode');
            }
        }

        applyTheme(savedTheme);

        const btn = document.getElementById('discussionThemeToggleBtn');
        if (btn) {
            btn.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                applyTheme(newTheme);
            });
        }
    }

    // Inject portable discussion header (solo / non-preview mode only)
    function injectDiscussionHeader() {
        const isIframe = window.self !== window.top;
        if (isIframe) return; // Hide header in index preview modal iframe

        if (document.getElementById('discussionMainHeader')) return;
        if (!document.body) {
            window.addEventListener('DOMContentLoaded', injectDiscussionHeader);
            return;
        }

        document.body.classList.add('has-discussion-header');

        const firstH1 = document.querySelector('.markdown-body h1, h1');
        if (firstH1) {
            firstH1.classList.add('discussion-first-heading-hidden');
            firstH1.style.setProperty('display', 'none', 'important');
        }

        const { title, subtitle } = getDiscussionTitleInfo();
        const indexPath = 'https://www.brettmrice.com/Clinical-Hematology-Lecture/';

        const header = document.createElement('header');
        header.id = 'discussionMainHeader';
        header.innerHTML = `
            <div class="discussion-header-container">
                <a href="${indexPath}" class="discussion-brand" title="Return to Index Explorer">
                    <div class="discussion-brand-icon">
                        <svg class="discussion-brand-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 14 4 9 9 4"></polyline>
                            <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                        </svg>
                    </div>
                    <div class="discussion-brand-text">
                        <div class="discussion-brand-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
                        <div class="discussion-brand-subtitle">${escapeHtml(subtitle)}</div>
                    </div>
                </a>

                <div class="discussion-header-actions">
                    <button class="discussion-header-top-btn" id="discussionHeaderTopBtn" aria-label="Back to top" title="Back to top">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 11l7-7 7 7M5 19l7-7 7 7"/>
                        </svg>
                    </button>
                    <button class="discussion-theme-btn" id="discussionThemeToggleBtn" aria-label="Toggle Theme" title="Toggle Theme">
                    </button>
                </div>
            </div>
        `;

        document.body.insertBefore(header, document.body.firstChild);
        initThemeToggle();
        initHeaderScroll();
    }

    // Scroll state observer for header shrinking & back-to-top button
    function initHeaderScroll() {
        const header = document.getElementById('discussionMainHeader');
        const headerTopBtn = document.getElementById('discussionHeaderTopBtn');

        if (headerTopBtn) {
            headerTopBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        if (!header) return;

        function updateHeaderState() {
            const scrollPos = window.scrollY || window.pageYOffset || 0;
            if (scrollPos > 20) {
                header.classList.add('header-shrunk');
            } else {
                header.classList.remove('header-shrunk');
            }

            const currentHeight = header.offsetHeight || 53;
            document.documentElement.style.setProperty('--discussion-header-height', `${currentHeight}px`);
        }

        window.addEventListener('scroll', updateHeaderState, { passive: true });
        window.addEventListener('resize', updateHeaderState, { passive: true });
        updateHeaderState();
    }

    // Initialization
    function init() {
        ensureCSS();
        companionMindMapFilename = resolveCompanionFilename(window.COURSE_MINDMAPS || window.COURSE_MINDMAPS_DATA || null);

        injectDiscussionHeader();
        injectOverlayDOM();
        initVisibilityObserver();

        // Asynchronously confirm / refine mapping from manifest if available
        ensureMindMapData((allMindMaps) => {
            const resolved = resolveCompanionFilename(allMindMaps);
            if (resolved && resolved !== '#' && resolved !== companionMindMapFilename) {
                companionMindMapFilename = resolved;
                const fab = document.getElementById('discussion-mindmap-fab');
                if (fab) fab.href = companionMindMapFilename;
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
