/**
 * Portable Discussion Mind Map Overlay & Knowledge Processing Engine
 * Synchronizes real-time discussion scroll position with companion Mind Map branches.
 */

(function () {
    'use strict';

    let activeHeadingText = '';
    let isModalOpen = false;
    let companionMindMapFilename = '';
    let savedScrollY = 0;

    // Determine candidate lookup keys from URL/path
    function getLookupKeys() {
        const path = window.location.pathname.replace(/\\/g, '/');
        const parts = path.split('/').filter(Boolean);
        const filename = parts.pop() || '';
        const rawName = filename.replace('.html', '');
        
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

        const match = rawName.match(/^(L\d+_[^_]+(?:_[^_]+)*?)(?:_S\d+)?(?:_Discussion|_Mind_Map)?$/i);
        const lessonKey = match ? match[1].toLowerCase() : rawName.toLowerCase();

        const candidates = [];
        if (folder && subfolder) candidates.push(`${folder}/${subfolder}/${lessonKey}`);
        if (folder) candidates.push(`${folder}/${lessonKey}`);
        candidates.push(lessonKey);
        candidates.push(rawName.toLowerCase());

        return candidates;
    }

    // Resolve relative path to shared assets
    function getSharedPath() {
        const scripts = document.querySelectorAll('script[src]');
        for (const s of scripts) {
            const src = s.getAttribute('src') || '';
            if (src.includes('discussion_mindmap.js')) {
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

    // Ensure data is loaded to get companion filename
    function ensureMindMapData(callback) {
        if (window.COURSE_MINDMAPS_DATA) {
            callback(window.COURSE_MINDMAPS_DATA);
            return;
        }

        const script = document.createElement('script');
        script.src = `${getSharedPath()}/course_mindmaps_data.js`;
        script.onload = () => {
            callback(window.COURSE_MINDMAPS_DATA || {});
        };
        script.onerror = () => {
            console.warn('Could not load course_mindmaps_data.js from', script.src);
            callback({});
        };
        document.head.appendChild(script);
    }

    // Resolve companion filename in the same directory
    function resolveCompanionFilename(allMindMaps) {
        const candidates = getLookupKeys();
        let matchedEntry = null;

        for (const key of candidates) {
            if (allMindMaps[key]) {
                matchedEntry = allMindMaps[key];
                break;
            }
        }

        if (!matchedEntry) {
            const keys = Object.keys(allMindMaps);
            for (const cand of candidates) {
                const found = keys.find(k => k.toLowerCase() === cand || k.toLowerCase().includes(cand));
                if (found) {
                    matchedEntry = allMindMaps[found];
                    break;
                }
            }
        }

        if (matchedEntry && matchedEntry.file) {
            return matchedEntry.file.split('/').pop();
        }

        // Fallback: Infer from current discussion filename
        const currentFile = window.location.pathname.replace(/\\/g, '/').split('/').pop() || '';
        return currentFile.replace(/_S\d+_Discussion|_Discussion/i, '_S1_Mind_Map');
    }

    // Build DOM elements (Pill Button linking directly to companion Mind Map in new tab with default view)
    function injectOverlayDOM() {
        if (document.getElementById('discussion-mindmap-fab')) return;
        if (!document.body) {
            window.addEventListener('DOMContentLoaded', injectOverlayDOM);
            return;
        }

        // Floating Action Button (FAB) - Styled as Navigation Button, opening Mind Map in new tab
        const fab = document.createElement('a');
        fab.id = 'discussion-mindmap-fab';
        fab.className = 'discussion-mindmap-fab';
        fab.setAttribute('title', 'Open Full Concept Mind Map in new tab');
        fab.setAttribute('aria-label', 'Open Full Concept Mind Map in new tab');
        fab.setAttribute('target', '_blank');
        fab.setAttribute('rel', 'noopener noreferrer');
        fab.href = companionMindMapFilename || '#';
        fab.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="fab-icon"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg><span class="fab-text">Mind Map</span>`;
        document.body.appendChild(fab);

        // Enhance jump-to-nav-btn with SVG icon if present
        const jumpNavBtn = document.getElementById('jump-to-nav-btn');
        if (jumpNavBtn && !jumpNavBtn.querySelector('svg')) {
            const text = jumpNavBtn.textContent.trim() || 'Navigation';
            jumpNavBtn.setAttribute('title', 'Jump to Course Navigation');
            jumpNavBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="fab-icon"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg><span class="fab-text">${escapeHtml(text)}</span>`;
        }

        fab.addEventListener('click', (e) => {
            if (companionMindMapFilename) {
                fab.href = companionMindMapFilename;
            } else {
                e.preventDefault();
                ensureMindMapData((allMindMaps) => {
                    companionMindMapFilename = resolveCompanionFilename(allMindMaps);
                    if (companionMindMapFilename) {
                        window.open(companionMindMapFilename, '_blank', 'noopener,noreferrer');
                    }
                });
            }
        });
    }

    // Visibility observer matching navigation button pattern
    function initVisibilityObserver() {
        const fab = document.getElementById('discussion-mindmap-fab');
        if (!fab) return;

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
            function updateVisibility() {
                if (window.scrollY > 150) {
                    fab.classList.add('visible');
                } else {
                    fab.classList.remove('visible');
                }
            }
            window.addEventListener('scroll', updateVisibility, { passive: true });
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

    // Resolve relative path to index.html
    function getRelativeIndexPath() {
        const path = window.location.pathname.replace(/\\/g, '/');
        const parts = path.split('/').filter(Boolean);
        let depth = 0;
        for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i].toLowerCase();
            if (p === 'lecture' || p === 'laboratory') {
                depth = parts.length - 1 - i + 1;
                break;
            }
        }
        if (depth === 0) return '../../index.html';
        return '../'.repeat(depth) + 'index.html';
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
        const indexPath = getRelativeIndexPath();

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
        injectDiscussionHeader();
        injectOverlayDOM();
        initVisibilityObserver();

        ensureMindMapData((allMindMaps) => {
            companionMindMapFilename = resolveCompanionFilename(allMindMaps);
            const fab = document.getElementById('discussion-mindmap-fab');
            if (fab && companionMindMapFilename) {
                fab.href = companionMindMapFilename;
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

