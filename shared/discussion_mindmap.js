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
        fab.innerHTML = `<span>Mind Map</span>`;
        document.body.appendChild(fab);

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

    // Initialization
    function init() {
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
