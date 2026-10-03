/**
 * ============================================================================
 * MIND MAP QUIZ GAME ("? Me") ENGINE
 * Clean, Portable, High-Yield Concept Relationship Quiz System
 * ============================================================================
 */

(function(window) {
  'use strict';

  // Helper to remove any 'L#' prefix from title
  function stripLNumber(title) {
    if (!title) return '';
    return title
      .replace(/^L\d+\s*[-_:]*\s*/i, '')
      .replace(/^(Lab|Lecture)\s*[-_:]*\s*/i, '')
      .trim();
  }

  // 16 Curriculum Mind Maps Registry Categorized & Ordered: Lecture then Lab
  const MIND_MAP_SECTIONS = [
    {
      section: 'Lecture: Physiology',
      maps: [
        { id: 'lec-phy-1', code: 'L1', rawTitle: 'Hematopoiesis', path: '../../Lecture/Physiology/L1_Hematopoiesis_S4_Mind_Map.html' },
        { id: 'lec-phy-2', code: 'L2', rawTitle: 'BCE RBC & Hemoglobin', path: '../../Lecture/Physiology/L2_BCE_RBC-HGB_S3_Mind_Map.html' },
        { id: 'lec-phy-3', code: 'L3', rawTitle: 'BCE WBC & Platelets', path: '../../Lecture/Physiology/L3_BCE_WBC-PLT_S4_Mind_Map.html' },
        { id: 'lec-phy-4', code: 'L4', rawTitle: 'RBC Indices & Morphologies', path: '../../Lecture/Physiology/L4_RBC_Analysis_S4_Mind_Map.html' }
      ]
    },
    {
      section: 'Laboratory: CBC & PBS',
      maps: [
        { id: 'lab-cbc-1', code: 'L1', rawTitle: 'Manual Counts', path: '../../Laboratory/CBC_PBS/L1_Manual_Counts_S3_Mind_Map.html' },
        { id: 'lab-cbc-2', code: 'L2', rawTitle: 'Slide Preparation', path: '../../Laboratory/CBC_PBS/L2_Slide_Preparation_S2_Mind_Map.html' },
        { id: 'lab-cbc-3', code: 'L3', rawTitle: 'Slide Evaluation', path: '../../Laboratory/CBC_PBS/L3_Slide_Evaluation_S3_Mind_Map.html' },
        { id: 'lab-cbc-4', code: 'L4', rawTitle: 'CBC Analysis', path: '../../Laboratory/CBC_PBS/L4_CBC_Analysis_S3_Mind_Map.html' }
      ]
    },
    {
      section: 'Lecture: Erythrocytes',
      maps: [
        { id: 'lec-ery-5', code: 'L5', rawTitle: 'Iron & Heme Metabolism', path: '../../Lecture/Erythrocytes/L5_Iron_Heme_S1_Mind_Map.html' },
        { id: 'lec-ery-6', code: 'L6', rawTitle: 'Hemoglobinopathies', path: '../../Lecture/Erythrocytes/L6_Hemoglobinopathy_S1_Mind_Map.html' },
        { id: 'lec-ery-7', code: 'L7', rawTitle: 'Macrocytic & Hypoproliferative', path: '../../Lecture/Erythrocytes/L7_Macros_Hypos_S1_Mind_Map.html' },
        { id: 'lec-ery-8', code: 'L8', rawTitle: 'Hemolytic Anemias', path: '../../Lecture/Erythrocytes/L8_Hemolytic_S1_Mind_Map.html' }
      ]
    },
    {
      section: 'Laboratory: Erythrocytes',
      maps: [
        { id: 'lab-ery-5', code: 'L5', rawTitle: 'Microcytic Anemias', path: '../../Laboratory/Erythrocytes/L5_Microcytic_S1_Mind_Map.html' },
        { id: 'lab-ery-6', code: 'L6', rawTitle: 'Hemoglobinopathies', path: '../../Laboratory/Erythrocytes/L6_Hemoglobinopathy_S1_Mind_Map.html' },
        { id: 'lab-ery-7', code: 'L7', rawTitle: 'Macrocytic Anemias', path: '../../Laboratory/Erythrocytes/L7_Macrocytic_S1_Mind_Map.html' },
        { id: 'lab-ery-8', code: 'L8', rawTitle: 'Normocytic Anemias', path: '../../Laboratory/Erythrocytes/L8_Normocytic_S1_Mind_Map.html' }
      ]
    }
  ];

  const ALL_MIND_MAPS = MIND_MAP_SECTIONS.flatMap(s => s.maps.map(m => ({
    ...m,
    title: stripLNumber(m.rawTitle)
  })));

  const STORAGE_KEY = 'CHGH_MINDMAP_QUIZ_STATS_V2';

  const SIGNATURE_KEY = '__chgh_quiz_signature__';

  class MindMapQuiz {
    constructor() {
      this.treeData = null;
      this.currentMapInfo = null;
      this.nodesById = new Map();
      this.nodesList = [];
      this.currentQuestion = null;
      this.selectedOptionIdx = null;
      this.selectedOption = null;
      this.selectedOutcome = null;
      this.questionStartTime = 0;
      this.elapsedBeforePause = 0;
      this.isAnswered = false;
      this.isDrawerOpen = false;
      this.isViewingOnMap = false;
      this.retryQueue = [];
      this.isRetryMode = false;
      this.activeAnimationTimers = [];
      this.broadcastChannel = null;

      this.initSyncChannel();
      this.stats = this.loadStats();
    }

    /**
     * Initialize cross-tab and cross-page synchronization listeners
     */
    initSyncChannel() {
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.broadcastChannel = new BroadcastChannel('CHGH_MINDMAP_QUIZ_SYNC');
          this.broadcastChannel.onmessage = (event) => {
            if (event && event.data && event.data.type === 'STATS_UPDATED' && event.data.stats) {
              const incoming = this.normalizeStats(event.data.stats);
              if (incoming && incoming.lastUpdated > (this.stats.lastUpdated || 0)) {
                this.stats = incoming;
                this.updateStatsDisplay();
                if (this.isDrawerOpen) this.renderDrawerContent();
              }
            }
          };
        } catch (e) {
          // Ignore BroadcastChannel errors in restricted sandbox
        }
      }

      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
          const incoming = this.parseStats(e.newValue);
          if (incoming && incoming.lastUpdated > (this.stats.lastUpdated || 0)) {
            this.stats = incoming;
            this.updateStatsDisplay();
            if (this.isDrawerOpen) this.renderDrawerContent();
          }
        }
      });

      const syncBeforeUnload = () => {
        this.saveStats();
      };
      window.addEventListener('beforeunload', syncBeforeUnload);
      window.addEventListener('pagehide', syncBeforeUnload);
    }

    /**
     * Initialize quiz with mind map data
     */
    init(data, bridge = null) {
      if (!data) return;
      this.treeData = data;
      this.bridge = bridge || window.MindMapBridge || null;
      this.detectCurrentMap();
      this.indexTree(this.treeData);
      this.injectUI();
      this.bindEvents();
      this.updateStatsDisplay();
      this.handleOverlayMode();
    }

    /**
     * Handle Topic Synchronization & Overlay Embed Mode from Discussion files
     */
    handleOverlayMode() {
      const params = new URLSearchParams(window.location.search);
      const isOverlay = params.get('overlay') === '1' || window.self !== window.top;
      if (isOverlay) {
        document.body.classList.add('is-overlay-embed');
      }

      const STOP_WORDS = new Set([
        'and', 'or', 'the', 'a', 'an', 'in', 'on', 'of', 'for', 'to', 'with', 'by',
        'at', 'from', 'complete', 'discussion', 'protocols', 'foundations', 'overview',
        'introduction', 'summary', 'key', 'points', 'review', 'vs', 'versus', 'section',
        'practical', 'verification', 'analysis', 'guide', 'notes'
      ]);

      const GENERIC_TOKENS = new Set(['aml', 'all', 'leukemia', 'neoplasm', 'neoplasms', 'acute', 'chronic', 'syndrome']);

      const SYNONYM_MAP = {
        'leukocyte': 'wbc',
        'leukocytes': 'wbc',
        'white blood cell': 'wbc',
        'white blood cells': 'wbc',
        'white': 'wbc',
        'erythrocyte': 'rbc',
        'erythrocytes': 'rbc',
        'red blood cell': 'rbc',
        'red blood cells': 'rbc',
        'red cell': 'rbc',
        'red cells': 'rbc',
        'nucleated rbc': 'nrbc',
        'nucleated rbcs': 'nrbc',
        'nucleated red blood cell': 'nrbc',
        'nucleated red blood cells': 'nrbc',
        'nrbcs': 'nrbc',
        'platelet': 'plt',
        'platelets': 'plt',
        'thrombocyte': 'plt',
        'thrombocytes': 'plt',
        'hemoglobin': 'hgb',
        'hb': 'hgb',
        'hematocrit': 'hct',
        'cbcd': 'cbc',
        'indices': 'cbc',
        'morphology': 'smear',
        'smear': 'smear',
        'blood smear': 'smear',
        'peripheral smear': 'smear',
        'peripheral blood smear': 'smear',
        'quality control': 'qc',
        'quality assurance': 'qc',
        'calculation': 'calc',
        'calculations': 'calc',
        'formula': 'calc',
        'formulas': 'calc',
        'differential': 'diff',
        'differentials': 'diff',
        'bone marrow': 'bm',
        'marrow': 'bm',
        'aspirate': 'aspirate',
        'biopsy': 'biopsy',
        'cytochemical': 'stain',
        'staining': 'stain',
        'ancillary': 'flow',
        'immunophenotyping': 'flow',
        'flow cytometry': 'flow',
        'acute myeloid leukemia': 'aml',
        'acute lymphoblastic leukemia': 'all',
        'myeloproliferative': 'mpn',
        'myelodysplastic': 'mds'
      };

      function normalizeAndCanonicalize(str) {
        if (!str) return [];
        let clean = str.toLowerCase().replace(/['"“”]/g, '');
        
        // Multi-word synonym replacement first
        for (const [k, v] of Object.entries(SYNONYM_MAP)) {
          if (k.includes(' ')) {
            clean = clean.split(k).join(` ${v} `);
          }
        }

        clean = clean.replace(/[^\w\s]/g, ' ');
        const tokens = clean.split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));
        return tokens.map(t => SYNONYM_MAP[t] || t);
      }

      const self = this;
      function syncTopic(topicQuery, contextData = null) {
        const bridge = self.bridge || window.MindMapBridge;
        const treeData = self.treeData || (bridge ? bridge.mindMapData : null) || window.mindMapData;
        if (!treeData || !bridge || !bridge.collapsedNodes) {
          setTimeout(() => {
            const b = self.bridge || window.MindMapBridge;
            const t = self.treeData || (b ? b.mindMapData : null) || window.mindMapData;
            if (t && b && b.collapsedNodes) syncTopic(topicQuery, contextData);
          }, 120);
          return;
        }

        const queryStr = topicQuery || (contextData ? contextData.topic : '') || '';
        if (!queryStr && !contextData) return;

        const qTokens = normalizeAndCanonicalize(queryStr);
        const h1Tokens = contextData && contextData.h1 ? normalizeAndCanonicalize(contextData.h1) : [];
        const h2Tokens = contextData && contextData.h2 ? normalizeAndCanonicalize(contextData.h2) : [];
        const breadcrumbTokens = contextData && Array.isArray(contextData.breadcrumbs) 
          ? contextData.breadcrumbs.flatMap(b => normalizeAndCanonicalize(b)) 
          : [];

        let matchedNode = null;
        let bestScore = -1;

        function searchTree(node, ancestors = []) {
          node._ancestors = ancestors;
          const nodeTokens = normalizeAndCanonicalize(node.text || '');
          const normNodeStr = nodeTokens.join(' ');
          const normQueryStr = qTokens.join(' ');

          let score = 0;

          // 1. Direct Topic Match
          if (normNodeStr && normQueryStr) {
            if (normNodeStr === normQueryStr) {
              score += 4000;
            } else if (normQueryStr.includes(normNodeStr)) {
              score += 2000 + (normNodeStr.length * 15);
            } else if (normNodeStr.includes(normQueryStr)) {
              score += 1500 + (normQueryStr.length * 15);
            } else {
              const common = qTokens.filter(w => nodeTokens.includes(w));
              if (common.length > 0) {
                common.forEach(w => {
                  const weight = GENERIC_TOKENS.has(w) ? 100 : (w.length > 3 ? 800 : 500);
                  score += weight;
                });
                const ratio = common.length / Math.max(qTokens.length, 1);
                score += (ratio * 600);
              }
            }
          }

          // 2. Breadcrumb / Major Section Alignment Bonus
          const level1Ancestor = ancestors.length > 1 ? ancestors[1] : (node.level === 1 ? node : null);
          if (level1Ancestor && (h1Tokens.length > 0 || h2Tokens.length > 0 || breadcrumbTokens.length > 0)) {
            const l1Tokens = normalizeAndCanonicalize(level1Ancestor.text || '');
            const h1Common = h1Tokens.filter(t => l1Tokens.includes(t) && !GENERIC_TOKENS.has(t));
            const h2Common = h2Tokens.filter(t => l1Tokens.includes(t) && !GENERIC_TOKENS.has(t));
            const bcCommon = breadcrumbTokens.filter(t => l1Tokens.includes(t) && !GENERIC_TOKENS.has(t));
            if (h1Common.length > 0) {
              score += h1Common.length * 300;
            }
            if (h2Common.length > 0) {
              score += h2Common.length * 250;
            } else if (bcCommon.length > 0) {
              score += bcCommon.length * 120;
            }
          }

          // 3. Deeper node specificity bonus
          if (score > 100 && node.level > 0) {
            score += node.level * 25;
          }

          if (score > bestScore) {
            bestScore = score;
            matchedNode = node;
          }

          if (Array.isArray(node.children)) {
            node.children.forEach(c => searchTree(c, [...ancestors, node]));
          }
        }

        searchTree(treeData, []);

        if (matchedNode && bridge.collapsedNodes) {
          window.isInitialLoad = false;

          // Collapse all level >= 1 nodes initially
          function setCollapsed(n) {
            if (n.level >= 1 && n.children && n.children.length > 0) {
              bridge.collapsedNodes.add(n.id);
            }
            if (n.children) n.children.forEach(setCollapsed);
          }
          bridge.collapsedNodes.clear();
          setCollapsed(treeData);

          // Expand all ancestors of matched node
          if (matchedNode._ancestors) {
            matchedNode._ancestors.forEach(anc => {
              bridge.collapsedNodes.delete(anc.id);
            });
          }
          // Expand matched node itself so its immediate branches are visible
          bridge.collapsedNodes.delete(matchedNode.id);

          if (typeof bridge.renderMindMap === 'function') {
            bridge.renderMindMap();
          }

          // Animate focus, fit whole visible tree to window, and highlight node
          setTimeout(() => {
            document.querySelectorAll('.active-topic-target').forEach(el => el.classList.remove('active-topic-target'));
            if (matchedNode.domEl) {
              matchedNode.domEl.classList.add('active-topic-target');
            }

            // Fit whole visible tree to modal window so everything is centered and legible
            if (typeof bridge.fitToWindow === 'function') {
              bridge.fitToWindow(true);
            } else if (typeof fitToWindow === 'function') {
              fitToWindow(true);
            } else {
              // Direct bounding-box focus calculation across all visible nodes
              const allVisibleEls = Array.from(document.querySelectorAll('.node')).filter(el => el.offsetParent !== null);
              let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
              const curScale = typeof bridge.getScale === 'function' ? bridge.getScale() : 1;
              const curTx = typeof bridge.getTranslateX === 'function' ? bridge.getTranslateX() : 0;
              const curTy = typeof bridge.getTranslateY === 'function' ? bridge.getTranslateY() : 0;

              allVisibleEls.forEach(el => {
                if (!el) return;
                const r = el.getBoundingClientRect();
                const x = (r.left - curTx) / curScale;
                const y = (r.top - curTy) / curScale;
                const w = r.width / curScale;
                const h = r.height / curScale;
                if (x < minX) minX = x;
                if (x + w > maxX) maxX = x + w;
                if (y < minY) minY = y;
                if (y + h > maxY) maxY = y + h;
              });

              if (isFinite(minX) && typeof bridge.setTransform === 'function') {
                const availW = window.innerWidth - 120;
                const availH = window.innerHeight - 120;
                const branchW = Math.max(120, maxX - minX);
                const branchH = Math.max(80, maxY - minY);
                let targetScale = Math.min(availW / branchW, availH / branchH);
                targetScale = Math.max(0.35, Math.min(targetScale, 1.0));

                const midX = (minX + maxX) / 2;
                const midY = (minY + maxY) / 2;
                const tx = (window.innerWidth / 2) - (midX * targetScale);
                const ty = (window.innerHeight / 2) - (midY * targetScale);

                bridge.setTransform(targetScale, tx, ty, true);
              }
            }
          }, 90);
        }
      }

      const initialTopic = params.get('topic');
      const initialH2 = params.get('h2');
      if (initialTopic || initialH2) {
        const initialContext = {
          topic: initialTopic,
          h2: initialH2,
          breadcrumbs: [initialH2, initialTopic].filter(Boolean)
        };
        setTimeout(() => syncTopic(initialTopic, initialContext), 150);
        setTimeout(() => syncTopic(initialTopic, initialContext), 400);
      }

      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'SYNC_TOPIC') {
          syncTopic(e.data.topic, e.data.context || null);
        }
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'DISMISS_MINDMAP_MODAL' }, '*');
          }
        }
      });
    }

    /**
     * Identify which mind map file is currently loaded
     */
    detectCurrentMap() {
      const pagePath = decodeURIComponent(window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
      const pageTitle = (document.title || '').trim();
      
      let matched = null;
      if (window.COURSE_MINDMAPS && Array.isArray(window.COURSE_MINDMAPS)) {
        const found = window.COURSE_MINDMAPS.find(m => {
          const cleanRel = (m.rel_path_from_shared || '').replace(/^(\.\.\/)+/, '').toLowerCase();
          return cleanRel && pagePath.endsWith(cleanRel);
        });
        if (found) {
          matched = {
            id: found.id,
            title: stripLNumber(found.title),
            path: found.rel_path_from_shared
          };
        }
      }

      if (!matched) {
        matched = ALL_MIND_MAPS.find(m => {
          const cleanPath = (m.path || '').replace(/^(\.\.\/)+/, '').toLowerCase();
          return cleanPath && pagePath.endsWith(cleanPath);
        });
      }

      if (!matched) {
        matched = ALL_MIND_MAPS.find(m => {
          const baseName = m.path.split('/').pop().toLowerCase();
          return pagePath.includes(baseName);
        });
      }

      if (!matched) {
        matched = {
          id: 'custom-' + encodeURIComponent(pageTitle.slice(0, 15) || 'map'),
          title: stripLNumber(pageTitle.replace(' - Interactive Mind Map', '') || 'Mind Map'),
          path: window.location.href
        };
      }
      this.currentMapInfo = matched;
    }

    /**
     * Parse tree data and index parent/ancestor/descendant relationships
     */
    indexTree(root) {
      this.nodesById.clear();
      this.nodesList = [];

      const traverse = (node, parent = null, ancestors = [], branchRoot = null) => {
        const nodeObj = {
          id: node.id || 'node-' + Math.random().toString(36).substr(2, 9),
          text: (node.text || '').trim(),
          level: node.level !== undefined ? node.level : ancestors.length,
          parentId: parent ? parent.id : null,
          ancestorIds: ancestors.map(a => a.id),
          childIds: [],
          descendantIds: [],
          leafIds: [],
          branchRootId: branchRoot ? branchRoot.id : (node.level === 1 ? node.id : (parent ? parent.id : node.id)),
          raw: node
        };

        this.nodesById.set(nodeObj.id, nodeObj);
        this.nodesList.push(nodeObj);

        if (node.children && Array.isArray(node.children)) {
          node.children.forEach(child => {
            const currentBranchRoot = node.level === 0 ? child : (branchRoot || child);
            const childObj = traverse(child, nodeObj, [...ancestors, nodeObj], currentBranchRoot);
            nodeObj.childIds.push(childObj.id);
          });
        }

        return nodeObj;
      };

      traverse(root);

      for (const node of this.nodesList) {
        const descendants = [];
        const leaves = [];
        const collectDescendants = (nId) => {
          const n = this.nodesById.get(nId);
          if (!n) return;
          for (const cId of n.childIds) {
            descendants.push(cId);
            const c = this.nodesById.get(cId);
            if (c && c.childIds.length === 0) {
              leaves.push(cId);
            } else {
              collectDescendants(cId);
            }
          }
        };
        collectDescendants(node.id);
        node.descendantIds = descendants;
        node.leafIds = leaves;
      }
    }

    normalizeStats(parsed) {
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        totalSeen: Number(parsed.totalSeen) || 0,
        totalCorrect: Number(parsed.totalCorrect) || 0,
        totalPartial: Number(parsed.totalPartial) || 0,
        totalIncorrect: Number(parsed.totalIncorrect) || 0,
        timesCorrect: Array.isArray(parsed.timesCorrect) ? parsed.timesCorrect : [],
        timesPartial: Array.isArray(parsed.timesPartial) ? parsed.timesPartial : [],
        timesIncorrect: Array.isArray(parsed.timesIncorrect) ? parsed.timesIncorrect : [],
        mapStats: (parsed.mapStats && typeof parsed.mapStats === 'object') ? parsed.mapStats : {},
        exposureLog: Array.isArray(parsed.exposureLog) ? parsed.exposureLog : [],
        lastUpdated: Number(parsed.lastUpdated) || 0
      };
    }

    parseStats(raw) {
      if (!raw) return null;
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return this.normalizeStats(parsed);
      } catch (e) {
        return null;
      }
    }

    encodeStats(stats) {
      try {
        const json = JSON.stringify(stats);
        if (typeof btoa === 'function') {
          return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
        }
        return encodeURIComponent(json);
      } catch (e) {
        return '';
      }
    }

    decodeStats(str) {
      if (!str) return null;
      try {
        const decoded = decodeURIComponent(str);
        let jsonStr = '';
        if (typeof atob === 'function') {
          try {
            jsonStr = decodeURIComponent(escape(atob(decoded)));
          } catch (e) {
            jsonStr = decoded;
          }
        } else {
          jsonStr = decoded;
        }
        return this.parseStats(jsonStr);
      } catch (e) {
        return null;
      }
    }

    /**
     * Load persistent stats across multiple storage tiers:
     * 1. URL Hash / Query param (#mmq=...) - guaranteed cross-directory bridge on file:// and http://
     * 2. window.name
     * 3. window.opener & window.parent
     * 4. localStorage
     * 5. sessionStorage
     */
    loadStats() {
      const candidates = [];

      // 1. Check URL Hash or Query parameter (bridges file:// cross-directory navigations)
      try {
        let urlPayload = '';
        if (window.location.hash) {
          const match = window.location.hash.match(/[#&](?:mmq|stats)=([^&]+)/);
          if (match) urlPayload = match[1];
        }
        if (!urlPayload && window.location.search) {
          const match = window.location.search.match(/[?&](?:mmq|stats)=([^&]+)/);
          if (match) urlPayload = match[1];
        }
        if (urlPayload) {
          const decoded = this.decodeStats(urlPayload);
          if (decoded) candidates.push(decoded);
          
          // Clean hash from address bar without reloading
          if (window.history && window.history.replaceState) {
            const cleanUrl = window.location.pathname + (window.location.search ? window.location.search.replace(/[?&](?:mmq|stats)=[^&]+/, '') : '');
            window.history.replaceState(null, document.title, cleanUrl);
          }
        }
      } catch (e) {}

      // 2. Check window.opener (if opened via new tab from another mind map or index)
      try {
        if (window.opener && !window.opener.closed) {
          if (window.opener.MindMapQuiz && window.opener.MindMapQuiz.stats) {
            const openerStats = this.normalizeStats(window.opener.MindMapQuiz.stats);
            if (openerStats) candidates.push(openerStats);
          }
        }
      } catch (e) {}

      // 3. Check window.parent (if running inside preview iframe)
      try {
        if (window.parent && window.parent !== window && window.parent.MindMapQuiz && window.parent.MindMapQuiz.stats) {
          const parentStats = this.normalizeStats(window.parent.MindMapQuiz.stats);
          if (parentStats) candidates.push(parentStats);
        }
      } catch (e) {}

      // 4. Check window.name (carries over across same-tab navigations)
      try {
        if (window.name) {
          const parsedWin = JSON.parse(window.name);
          if (parsedWin && parsedWin[SIGNATURE_KEY] === STORAGE_KEY && parsedWin.stats) {
            const normalized = this.normalizeStats(parsedWin.stats);
            if (normalized) candidates.push(normalized);
          } else if (parsedWin && parsedWin.totalSeen !== undefined) {
            const normalized = this.normalizeStats(parsedWin);
            if (normalized) candidates.push(normalized);
          }
        }
      } catch (e) {}

      // 5. Check localStorage
      try {
        const rawLocal = localStorage.getItem(STORAGE_KEY);
        if (rawLocal) {
          const normalized = this.parseStats(rawLocal);
          if (normalized) candidates.push(normalized);
        }
      } catch (e) {}

      // 6. Check sessionStorage
      try {
        const rawSession = sessionStorage.getItem(STORAGE_KEY);
        if (rawSession) {
          const normalized = this.parseStats(rawSession);
          if (normalized) candidates.push(normalized);
        }
      } catch (e) {}

      if (candidates.length > 0) {
        // Pick the candidate with the highest lastUpdated or most totalSeen
        candidates.sort((a, b) => {
          if (b.lastUpdated !== a.lastUpdated) return (b.lastUpdated || 0) - (a.lastUpdated || 0);
          return (b.totalSeen || 0) - (a.totalSeen || 0);
        });

        const best = candidates[0];

        // Merge any missing exposure log items and mapStats from other candidates
        for (let i = 1; i < candidates.length; i++) {
          const other = candidates[i];
          if (other.exposureLog && Array.isArray(other.exposureLog)) {
            const existingIds = new Set(best.exposureLog.map(l => l.id));
            other.exposureLog.forEach(l => {
              if (l && l.id && !existingIds.has(l.id)) {
                best.exposureLog.push(l);
                existingIds.add(l.id);
              }
            });
          }
          if (other.mapStats && typeof other.mapStats === 'object') {
            for (const [mId, mData] of Object.entries(other.mapStats)) {
              if (!best.mapStats[mId]) {
                best.mapStats[mId] = mData;
              } else {
                best.mapStats[mId].seen = Math.max(best.mapStats[mId].seen || 0, mData.seen || 0);
                best.mapStats[mId].correct = Math.max(best.mapStats[mId].correct || 0, mData.correct || 0);
                best.mapStats[mId].partial = Math.max(best.mapStats[mId].partial || 0, mData.partial || 0);
                best.mapStats[mId].incorrect = Math.max(best.mapStats[mId].incorrect || 0, mData.incorrect || 0);
              }
            }
          }
        }

        // Keep exposure log sorted by recency
        if (best.exposureLog.length > 200) {
          best.exposureLog = best.exposureLog.slice(0, 200);
        }

        // Sync immediately to all tiers
        setTimeout(() => this.saveStats(), 0);
        return best;
      }

      return {
        totalSeen: 0,
        totalCorrect: 0,
        totalPartial: 0,
        totalIncorrect: 0,
        timesCorrect: [],
        timesPartial: [],
        timesIncorrect: [],
        mapStats: {},
        exposureLog: [],
        lastUpdated: Date.now()
      };
    }

    /**
     * Save stats simultaneously to localStorage, sessionStorage, window.name, BroadcastChannel, opener & parent
     */
    saveStats() {
      this.stats.lastUpdated = Date.now();
      const jsonStr = JSON.stringify(this.stats);

      // 1. LocalStorage
      try {
        localStorage.setItem(STORAGE_KEY, jsonStr);
      } catch (e) {}

      // 2. SessionStorage
      try {
        sessionStorage.setItem(STORAGE_KEY, jsonStr);
      } catch (e) {}

      // 3. window.name (guaranteed tab persistence across file:// directories)
      try {
        window.name = JSON.stringify({
          [SIGNATURE_KEY]: STORAGE_KEY,
          stats: this.stats
        });
      } catch (e) {}

      // 4. BroadcastChannel
      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({
            type: 'STATS_UPDATED',
            stats: this.stats
          });
        } catch (e) {}
      }

      // 5. Sync to opener window if available
      try {
        if (window.opener && !window.opener.closed && window.opener.MindMapQuiz) {
          window.opener.MindMapQuiz.stats = this.stats;
        }
      } catch (e) {}

      // 6. Sync to parent window if inside preview iframe
      try {
        if (window.parent && window.parent !== window && window.parent.MindMapQuiz) {
          window.parent.MindMapQuiz.stats = this.stats;
        }
      } catch (e) {}
    }

    exitRetryMode() {
      this.isRetryMode = false;
      this.retryQueue = [];
      this.updateRetryUI();
    }

    updateRetryUI() {
      const retryBadge = document.getElementById('mm-quiz-retry-badge');
      const retryCountEl = document.getElementById('mm-retry-count');
      const btnNext = document.getElementById('mm-btn-next-question');
      const btnNextMissed = document.getElementById('mm-btn-next-missed');
      const btnNew = document.getElementById('mm-btn-new-question');

      if (this.isRetryMode) {
        if (retryBadge) retryBadge.style.display = 'inline-flex';
        const remaining = this.retryQueue.length + (this.currentQuestion ? 1 : 0);
        if (retryCountEl) retryCountEl.textContent = remaining;

        if (btnNext) btnNext.style.display = 'none';
        if (btnNextMissed) {
          btnNextMissed.style.display = 'inline-flex';
          btnNextMissed.disabled = !this.isAnswered;
        }
        if (btnNew) {
          btnNew.style.display = 'inline-flex';
          btnNew.disabled = false;
        }
      } else {
        if (retryBadge) retryBadge.style.display = 'none';
        if (btnNext) {
          btnNext.style.display = 'inline-flex';
          btnNext.disabled = !this.isAnswered;
        }
        if (btnNextMissed) btnNextMissed.style.display = 'none';
        if (btnNew) btnNew.style.display = 'none';
      }
    }

    /**
     * Question Generation Engine
     */
    generateQuestion() {
      if (this.isRetryMode) {
        while (this.retryQueue.length > 0) {
          const retryItem = this.retryQueue.shift();
          const refNode = this.nodesById.get(retryItem.refId) || this.findNodeByText(retryItem.refText);
          if (refNode) {
            const q = this.buildQuestionForNode(refNode, retryItem.queryType);
            if (q) return q;
          }
        }
        // If queue is now empty (or no valid nodes found), automatically exit retry mode
        this.exitRetryMode();
      }

      const eligibleNodes = this.nodesList.filter(n => n.text && n.text.length > 1 && n.id !== 'root');
      if (eligibleNodes.length === 0) return null;

      const refNode = eligibleNodes[Math.floor(Math.random() * eligibleNodes.length)];

      const nonRootAncestors = refNode.ancestorIds
        .map(id => this.nodesById.get(id))
        .filter(n => n && n.level > 0);

      const candidateTypes = [];
      if (refNode.ancestorIds.length >= 1) {
        candidateTypes.push('Closest Upstream?');
        if (nonRootAncestors.length >= 2) candidateTypes.push('Furthest Upstream?');
      }
      if (refNode.childIds.length >= 1) {
        candidateTypes.push('Closest Downstream?');
      }
      if (refNode.descendantIds.length >= 2 || refNode.leafIds.length >= 1) {
        candidateTypes.push('Furthest Downstream?');
      }

      if (candidateTypes.length === 0) {
        candidateTypes.push(refNode.ancestorIds.length > 0 ? 'Closest Upstream?' : 'Closest Downstream?');
      }

      const queryType = candidateTypes[Math.floor(Math.random() * candidateTypes.length)];
      return this.buildQuestionForNode(refNode, queryType);
    }

    findNodeByText(text) {
      if (!text) return null;
      return this.nodesList.find(n => n.text === text);
    }

    buildQuestionForNode(refNode, queryType) {
      let targetNode = null;
      const partialNodes = [];
      const incorrectNodes = [];

      if (queryType === 'Furthest Upstream?') {
        const nonRootAncestors = refNode.ancestorIds
          .map(id => this.nodesById.get(id))
          .filter(n => n && n.level > 0);
        if (nonRootAncestors.length === 0) return null;
        targetNode = nonRootAncestors[0];

        for (let i = 1; i < nonRootAncestors.length; i++) {
          partialNodes.push(nonRootAncestors[i]);
        }

        const unrelated = this.nodesList.filter(n => 
          n.id !== refNode.id && 
          n.level > 0 &&
          !refNode.ancestorIds.includes(n.id) &&
          !refNode.descendantIds.includes(n.id)
        );
        this.shuffleArray(unrelated);
        incorrectNodes.push(...unrelated.slice(0, 3));
      } 
      else if (queryType === 'Closest Upstream?') {
        if (!refNode.parentId) return null;
        targetNode = this.nodesById.get(refNode.parentId);

        const ancestorNodes = refNode.ancestorIds
          .map(id => this.nodesById.get(id))
          .filter(n => n && n.id !== refNode.parentId);
        partialNodes.push(...ancestorNodes);

        const unrelated = this.nodesList.filter(n => 
          n.id !== refNode.id && 
          !refNode.ancestorIds.includes(n.id)
        );
        this.shuffleArray(unrelated);
        incorrectNodes.push(...unrelated.slice(0, 3));
      } 
      else if (queryType === 'Closest Downstream?') {
        if (refNode.childIds.length === 0) return null;
        const children = refNode.childIds.map(id => this.nodesById.get(id)).filter(Boolean);
        this.shuffleArray(children);
        targetNode = children[0];

        const deeperDescendants = refNode.descendantIds
          .map(id => this.nodesById.get(id))
          .filter(n => n && !refNode.childIds.includes(n.id));
        this.shuffleArray(deeperDescendants);
        partialNodes.push(...deeperDescendants.slice(0, 2));

        const unrelated = this.nodesList.filter(n => 
          n.id !== refNode.id && 
          !refNode.descendantIds.includes(n.id)
        );
        this.shuffleArray(unrelated);
        incorrectNodes.push(...unrelated.slice(0, 3));
      } 
      else if (queryType === 'Furthest Downstream?') {
        if (refNode.descendantIds.length === 0) return null;
        
        let maxDepth = -1;
        let candidateLeaves = [];
        for (const descId of refNode.descendantIds) {
          const desc = this.nodesById.get(descId);
          if (desc) {
            const depth = desc.level - refNode.level;
            if (desc.childIds.length === 0) {
              if (depth > maxDepth) {
                maxDepth = depth;
                candidateLeaves = [desc];
              } else if (depth === maxDepth) {
                candidateLeaves.push(desc);
              }
            }
          }
        }

        if (candidateLeaves.length === 0) {
          const descNodes = refNode.descendantIds.map(id => this.nodesById.get(id)).filter(Boolean);
          this.shuffleArray(descNodes);
          targetNode = descNodes[0];
        } else {
          this.shuffleArray(candidateLeaves);
          targetNode = candidateLeaves[0];
        }

        const intermediateDescendants = refNode.descendantIds
          .map(id => this.nodesById.get(id))
          .filter(n => n && n.id !== targetNode.id);
        this.shuffleArray(intermediateDescendants);
        partialNodes.push(...intermediateDescendants.slice(0, 2));

        const unrelated = this.nodesList.filter(n => 
          n.id !== refNode.id && 
          !refNode.descendantIds.includes(n.id)
        );
        this.shuffleArray(unrelated);
        incorrectNodes.push(...unrelated.slice(0, 3));
      }

      if (!targetNode) return null;

      const options = [];
      options.push({
        id: targetNode.id,
        text: targetNode.text,
        type: 'target',
        node: targetNode
      });

      this.shuffleArray(partialNodes);
      const chosenPartials = partialNodes.slice(0, 2);
      for (const p of chosenPartials) {
        options.push({
          id: p.id,
          text: p.text,
          type: 'partial',
          node: p
        });
      }

      this.shuffleArray(incorrectNodes);
      const neededIncorrects = Math.max(1, 4 - options.length);
      for (let i = 0; i < neededIncorrects && i < incorrectNodes.length; i++) {
        options.push({
          id: incorrectNodes[i].id,
          text: incorrectNodes[i].text,
          type: 'incorrect',
          node: incorrectNodes[i]
        });
      }

      this.shuffleArray(options);

      // Upstream -> Options on Left, Reference on Right (refSide = 'right')
      // Downstream -> Reference on Left, Options on Right (refSide = 'left')
      const refSide = queryType.includes('Upstream') ? 'right' : 'left';

      return {
        refNode: refNode,
        queryType: queryType,
        targetNode: targetNode,
        options: options,
        refSide: refSide,
        createdAt: Date.now()
      };
    }

    shuffleArray(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    /**
     * DOM Injection: Create button, modal overlay, and stats drawer
     */
    injectUI() {
      // 1. Inject Launch Button into host page if not present
      if (!document.getElementById('btn-quiz-me')) {
        const quizBtn = document.createElement('div');
        quizBtn.className = 'floating-panel top-quiz-card';
        quizBtn.id = 'btn-quiz-me';
        quizBtn.title = 'Test your knowledge with Quiz Mode';
        quizBtn.innerHTML = `? Me`;
        document.body.appendChild(quizBtn);
      }

      // 2. Floating Playback HUD on Mind Map View
      let existingHud = document.getElementById('mm-map-playback-hud');
      if (existingHud) existingHud.remove();

      const hud = document.createElement('div');
      hud.id = 'mm-map-playback-hud';
      hud.className = 'floating-panel mm-map-playback-hud';
      hud.style.display = 'none';
      hud.innerHTML = `
        <div class="mm-hud-content">
          <div class="mm-hud-details">
            <span class="mm-hud-badge">Concept Navigation</span>
            <div class="mm-hud-summary" id="mm-hud-summary-text"></div>
          </div>
          <div class="mm-hud-actions">
            <button class="mm-hud-btn mm-hud-btn-return" id="mm-hud-btn-return" title="Return to Quiz Game (Shortcut: R or G)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 14l-4-4 4-4M5 10h11a4 4 0 1 1 0 8h-1"/>
              </svg>
              <span>Return to Game [R or G]</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(hud);

      // 3. Inject Modal Overlay Backdrop
      let overlay = document.getElementById('mm-quiz-overlay');
      if (overlay) {
        overlay.remove(); // Clean fresh injection
      }

      overlay = document.createElement('div');
      overlay.id = 'mm-quiz-overlay';
      overlay.innerHTML = `
        <div class="mm-quiz-modal" id="mm-quiz-modal">
          <!-- Header with Left-Aligned Title without 'L#' and Centered Retry Badge -->
          <div class="mm-quiz-header">
            <div class="mm-quiz-title-wrap">
              <span class="mm-quiz-badge">Quiz Game</span>
              <span class="mm-quiz-title" id="mm-quiz-map-title">Mind Map Quiz</span>
            </div>
            <div class="mm-quiz-retry-badge" id="mm-quiz-retry-badge" style="display: none;">
              <span class="mm-retry-dot"></span>
              <span>Retrying Missed (<span id="mm-retry-count">0</span> remaining)</span>
            </div>
            <div class="mm-quiz-header-actions">
              <button class="mm-quiz-btn-header" id="mm-btn-header-close" title="Close (or click outside blur)">✕</button>
            </div>
          </div>

          <!-- Body -->
          <div class="mm-quiz-body" id="mm-quiz-body-area">
            <!-- 'Choose' Banner: Aligns dynamically to options side with Lavender Pulse -->
            <div class="mm-quiz-question-banner-wrap" id="mm-question-banner-wrap">
              <div class="mm-quiz-question-banner">
                <div class="mm-quiz-instruction" id="mm-instruction-text">
                  <span>Choose</span>
                  <span class="query-highlight" id="mm-query-type">Furthest Upstream?</span>
                </div>
              </div>
            </div>

            <!-- Interactive Mermaid Diagram Stage -->
            <div class="mm-quiz-stage" id="mm-quiz-stage">
              <svg class="mm-quiz-svg-canvas" id="mm-quiz-svg"></svg>
              
              <!-- Reference Pill Column -->
              <div class="mm-quiz-col mm-quiz-col-ref" id="mm-col-ref">
                <span class="mm-quiz-pill-ref-label">Reference Concept</span>
                <div class="mm-quiz-pill mm-quiz-pill-ref" id="mm-ref-pill"></div>
              </div>

              <!-- Option Pills Column -->
              <div class="mm-quiz-col mm-quiz-col-options" id="mm-col-options"></div>
            </div>

            <!-- Feedback & Explanation Box -->
            <div class="mm-quiz-feedback-box" id="mm-feedback-box"></div>

            <!-- Live Session Stats Bar (Hidden until selection is made) -->
            <div class="mm-quiz-stats-bar" id="mm-quiz-stats-bar">
              <div class="mm-stat-item">
                <div class="mm-stat-val mm-stat-blue" id="stat-total-seen">0</div>
                <div class="mm-stat-label">Total Seen</div>
              </div>
              <div class="mm-stat-item">
                <div class="mm-stat-val stat-green" id="stat-correct">0 (0%)</div>
                <div class="mm-stat-label">Correct</div>
              </div>
              <div class="mm-stat-item">
                <div class="mm-stat-val stat-amber" id="stat-partial">0 (0%)</div>
                <div class="mm-stat-label">Partial Correct</div>
              </div>
              <div class="mm-stat-item">
                <div class="mm-stat-val mm-stat-blue" id="stat-accuracy">0%</div>
                <div class="mm-stat-label">Accuracy (Cor+Part)</div>
              </div>
              <div class="mm-stat-item">
                <div class="mm-stat-val" id="stat-avg-time">0.0s</div>
                <div class="mm-stat-label">Avg Decision Time</div>
              </div>
            </div>
          </div>

          <!-- Footer: 
               - Left: Close & Return
               - Center: View [V] on Mind Map [M], Next Question [Space or Enter], Next Missed / New Question (in Retry Mode)
               - Right: Stats & History -->
          <div class="mm-quiz-footer">
            <div class="mm-quiz-footer-left">
              <button class="mm-quiz-btn mm-quiz-btn-secondary" id="mm-btn-footer-close">Close & Return</button>
            </div>
            <div class="mm-quiz-footer-center">
              <button class="mm-quiz-btn mm-quiz-btn-secondary mm-quiz-btn-view-map" id="mm-btn-view-map" disabled title="View this concept relationship directly on the Mind Map">View [V] on Mind Map [M]</button>
              <button class="mm-quiz-btn mm-quiz-btn-primary" id="mm-btn-next-question" disabled>Next Question [Space or Enter]</button>
              <button class="mm-quiz-btn mm-quiz-btn-primary" id="mm-btn-next-missed" style="display: none;" disabled>Next Missed [Space or Enter]</button>
              <button class="mm-quiz-btn mm-quiz-btn-secondary" id="mm-btn-new-question" style="display: none;" title="Exit retry mode and start a new question (Shortcut: N)">New Question</button>
            </div>
            <div class="mm-quiz-footer-right">
              <button class="mm-quiz-btn mm-quiz-btn-secondary" id="mm-btn-toggle-stats">Stats & History</button>
            </div>
          </div>
        </div>

        <!-- Slide-out Stats Drawer Backdrop (click to close drawer) -->
        <div class="mm-quiz-drawer-backdrop" id="mm-drawer-backdrop"></div>

        <!-- Stats & History Slide-out Drawer (with top/bottom gap for blur visibility) -->
        <div class="mm-quiz-drawer" id="mm-quiz-drawer">
          <div class="mm-drawer-header">
            <div class="mm-drawer-title">Session Analytics & Cross-Map Progress</div>
            <button class="mm-quiz-btn-header" id="mm-btn-drawer-close">✕</button>
          </div>
          <div class="mm-drawer-body">
            <!-- Storage Notice -->
            <div class="mm-storage-notice">
              <strong>Local Storage Notice:</strong> Progress is stored only locally in this browser and will not sync across other devices or browsers without exporting and importing. When viewing local file:// links, some browsers isolate storage per folder—use Export JSON to save a backup, and Import JSON to restore or transfer anywhere.
            </div>

            <!-- Decision Speed Breakdown -->
            <div>
              <div class="mm-drawer-section-title">Decision Speed Breakdown</div>
              <table class="mm-maps-table">
                <thead>
                  <tr><th>Category</th><th class="th-num th-time">Avg Time</th><th class="th-num th-attempts">Attempts</th></tr>
                </thead>
                <tbody>
                  <tr><td>Correct Decisions</td><td class="td-num" id="drawer-time-correct">0.0s</td><td class="td-num" id="drawer-count-correct">0</td></tr>
                  <tr><td>Partial Correct</td><td class="td-num" id="drawer-time-partial">0.0s</td><td class="td-num" id="drawer-count-partial">0</td></tr>
                  <tr><td>Incorrect Decisions</td><td class="td-num" id="drawer-time-incorrect">0.0s</td><td class="td-num" id="drawer-count-incorrect">0</td></tr>
                </tbody>
              </table>
            </div>

            <!-- Visited Mind Maps Directory by Section and Ordered by L# -->
            <div>
              <div class="mm-drawer-section-title">Mind Maps Directory</div>
              <div id="mm-drawer-sections-container"></div>
            </div>

            <!-- Exposure Log -->
            <div>
              <div class="mm-drawer-section-title">
                <span>Exposure Log (<span id="drawer-log-count">0</span>)</span>
                <button class="mm-quiz-btn-header" id="mm-btn-retry-missed" style="font-size: 11px; padding: 3px 8px;">Retry Missed</button>
              </div>
              <div class="mm-log-list" id="mm-drawer-log-list">
                <div style="color: #94a3b8; font-size: 11px; text-align: center; padding: 10px;">No questions answered yet.</div>
              </div>
            </div>

            <!-- Actions: Export/Import on Left, Reset on Right -->
            <div class="mm-drawer-actions">
              <div class="mm-drawer-actions-left">
                <button class="mm-quiz-btn mm-quiz-btn-secondary" id="mm-btn-export-json">Export JSON</button>
                <button class="mm-quiz-btn mm-quiz-btn-secondary" id="mm-btn-import-json">Import JSON</button>
              </div>
              <div class="mm-drawer-actions-right">
                <button class="mm-quiz-btn mm-quiz-btn-secondary" id="mm-btn-reset-stats" style="color: #dc2626; border-color: #fca5a5;">Reset Stats</button>
              </div>
              <input type="file" id="mm-file-import" accept=".json" style="display: none;">
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    /**
     * Bind UI event listeners
     */
    bindEvents() {
      const launchBtn = document.getElementById('btn-quiz-me');
      const overlay = document.getElementById('mm-quiz-overlay');
      const modal = document.getElementById('mm-quiz-modal');
      const btnHeaderClose = document.getElementById('mm-btn-header-close');
      const btnFooterClose = document.getElementById('mm-btn-footer-close');
      const btnViewMap = document.getElementById('mm-btn-view-map');
      const btnNext = document.getElementById('mm-btn-next-question');
      const btnNextMissed = document.getElementById('mm-btn-next-missed');
      const btnNewQuestion = document.getElementById('mm-btn-new-question');
      const btnToggleStats = document.getElementById('mm-btn-toggle-stats');
      const btnDrawerClose = document.getElementById('mm-btn-drawer-close');
      const drawerBackdrop = document.getElementById('mm-drawer-backdrop');
      const bodyArea = document.getElementById('mm-quiz-body-area');
      const btnRetryMissed = document.getElementById('mm-btn-retry-missed');
      const btnExport = document.getElementById('mm-btn-export-json');
      const btnImport = document.getElementById('mm-btn-import-json');
      const fileInput = document.getElementById('mm-file-import');
      const btnReset = document.getElementById('mm-btn-reset-stats');

      // Launch Quiz
      if (launchBtn) {
        launchBtn.addEventListener('click', () => this.openQuiz());
      }

      // Dismiss Quiz
      const closeQuiz = () => this.closeQuiz();
      if (btnHeaderClose) btnHeaderClose.addEventListener('click', closeQuiz);
      if (btnFooterClose) btnFooterClose.addEventListener('click', closeQuiz);

      if (overlay) {
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            if (this.isDrawerOpen) {
              this.toggleDrawer(false);
            } else {
              this.closeQuiz();
            }
          }
        });
      }

      // Stats Drawer: Backdrop click closes drawer
      if (drawerBackdrop) {
        drawerBackdrop.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleDrawer(false);
        });
      }

      // Clicking game arena when stats drawer is open closes the drawer
      if (bodyArea) {
        bodyArea.addEventListener('click', () => {
          if (this.isDrawerOpen) {
            this.toggleDrawer(false);
          }
        });
      }

      // View on Mind Map
      if (btnViewMap) {
        btnViewMap.addEventListener('click', (e) => {
          e.stopPropagation();
          this.viewOnMindMap();
        });
      }

      // Next Question (Standard Mode)
      if (btnNext) {
        btnNext.addEventListener('click', (e) => {
          e.stopPropagation();
          this.nextQuestion();
        });
      }

      // Next Missed (Retry Mode)
      if (btnNextMissed) {
        btnNextMissed.addEventListener('click', (e) => {
          e.stopPropagation();
          this.nextQuestion();
        });
      }

      // New Question (Cancel Retry Mode and start fresh)
      if (btnNewQuestion) {
        btnNewQuestion.addEventListener('click', (e) => {
          e.stopPropagation();
          this.exitRetryMode();
          this.nextQuestion();
        });
      }

      // Stats Drawer Toggle
      if (btnToggleStats) {
        btnToggleStats.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleDrawer();
        });
      }
      if (btnDrawerClose) {
        btnDrawerClose.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleDrawer(false);
        });
      }

      // Playback HUD Buttons
      const btnHudReturn = document.getElementById('mm-hud-btn-return');
      if (btnHudReturn) {
        btnHudReturn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.returnToGameFromMindMap();
        });
      }

      // Keyboard Shortcuts
      window.addEventListener('keydown', (e) => {
        // Return shortcut if currently viewing on Mind Map
        if (this.isViewingOnMap) {
          if (e.key === 'r' || e.key === 'R' || e.key === 'g' || e.key === 'G' || e.key === 'Escape') {
            e.preventDefault();
            this.returnToGameFromMindMap();
            return;
          }
        }

        if (!overlay || !overlay.classList.contains('active')) return;

        if (e.key === 'Escape') {
          if (this.isDrawerOpen) {
            this.toggleDrawer(false);
          } else {
            this.closeQuiz();
          }
        } else if ((e.key === 'Enter' || e.key === ' ') && this.isAnswered && !this.isDrawerOpen) {
          e.preventDefault();
          this.nextQuestion();
        } else if ((e.key === 'n' || e.key === 'N') && !this.isDrawerOpen && this.isRetryMode) {
          e.preventDefault();
          this.exitRetryMode();
          this.nextQuestion();
        } else if ((e.key === 'v' || e.key === 'V' || e.key === 'm' || e.key === 'M') && this.isAnswered && !this.isDrawerOpen) {
          e.preventDefault();
          this.viewOnMindMap();
        }
      });

      // Retry Missed Questions (only questions with partial/incorrect and 0 correct answers)
      if (btnRetryMissed) {
        btnRetryMissed.addEventListener('click', () => {
          // Identify all question keys that have been answered correctly at least once
          const correctQuestionKeys = new Set();
          this.stats.exposureLog.forEach(l => {
            if (l.outcome === 'correct') {
              const textKey = `${(l.refText || '').trim()}:::${l.queryType}`;
              correctQuestionKeys.add(textKey);
              if (l.refId) correctQuestionKeys.add(`${l.refId}:::${l.queryType}`);
            }
          });

          // Filter for questions answered partial or incorrect that have NEVER been answered correctly
          const seenInQueue = new Set();
          const missed = [];

          this.stats.exposureLog.forEach(l => {
            if (l.outcome !== 'correct') {
              const textKey = `${(l.refText || '').trim()}:::${l.queryType}`;
              const idKey = l.refId ? `${l.refId}:::${l.queryType}` : textKey;

              if (!correctQuestionKeys.has(textKey) && !correctQuestionKeys.has(idKey)) {
                if (!seenInQueue.has(textKey)) {
                  seenInQueue.add(textKey);
                  missed.push({
                    refId: l.refId,
                    refText: l.refText,
                    queryType: l.queryType
                  });
                }
              }
            }
          });

          if (missed.length === 0) {
            alert('Great job! You have no missed or partial questions that haven\'t already been answered correctly.');
            return;
          }

          this.retryQueue = missed;
          this.isRetryMode = true;
          this.toggleDrawer(false);
          this.nextQuestion();
        });
      }

      // Export JSON
      if (btnExport) {
        btnExport.addEventListener('click', () => this.exportStatsJSON());
      }

      // Import JSON
      if (btnImport && fileInput) {
        btnImport.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.importStatsJSON(e));
      }

      // Reset Stats
      if (btnReset) {
        btnReset.addEventListener('click', () => {
          if (confirm('Are you sure you want to reset all quiz statistics and logs?')) {
            this.exitRetryMode();
            this.stats = {
              totalSeen: 0,
              totalCorrect: 0,
              totalPartial: 0,
              totalIncorrect: 0,
              timesCorrect: [],
              timesPartial: [],
              timesIncorrect: [],
              mapStats: {},
              exposureLog: []
            };
            this.saveStats();
            this.updateStatsDisplay();
            this.renderDrawerContent();
          }
        });
      }

      // Window resize: re-draw mermaid connecting curves
      window.addEventListener('resize', () => {
        if (overlay && overlay.classList.contains('active')) {
          this.drawMermaidConnectors();
        }
      });
    }

    openQuiz() {
      const overlay = document.getElementById('mm-quiz-overlay');
      if (!overlay) return;

      this.cleanupMindMapHighlights();
      this.isViewingOnMap = false;

      document.body.classList.add('quiz-open');
      overlay.classList.add('active');

      const titleEl = document.getElementById('mm-quiz-map-title');
      if (titleEl && this.currentMapInfo) {
        titleEl.textContent = this.currentMapInfo.title;
      }

      if (!this.currentQuestion) {
        this.nextQuestion();
      } else {
        this.questionStartTime = Date.now() - this.elapsedBeforePause;
        // Reliably restore the existing question view and DOM elements
        this.restoreQuestionView();
      }
    }

    closeQuiz() {
      const overlay = document.getElementById('mm-quiz-overlay');
      if (!overlay) return;

      if (!this.isAnswered) {
        this.elapsedBeforePause = Date.now() - this.questionStartTime;
      }

      document.body.classList.remove('quiz-open');
      overlay.classList.remove('active');
      this.toggleDrawer(false);
    }

    toggleDrawer(forceState = null) {
      const drawer = document.getElementById('mm-quiz-drawer');
      const backdrop = document.getElementById('mm-drawer-backdrop');
      const btn = document.getElementById('mm-btn-toggle-stats');
      if (!drawer) return;

      this.isDrawerOpen = forceState !== null ? forceState : !this.isDrawerOpen;
      drawer.classList.toggle('open', this.isDrawerOpen);
      if (backdrop) backdrop.classList.toggle('open', this.isDrawerOpen);
      if (btn) btn.classList.toggle('active', this.isDrawerOpen);

      if (this.isDrawerOpen) {
        this.renderDrawerContent();
      }
    }

    nextQuestion() {
      const q = this.generateQuestion();
      if (!q) {
        alert('Not enough hierarchical nodes found in this mind map to generate quiz questions.');
        return;
      }

      this.currentQuestion = q;
      this.selectedOptionIdx = null;
      this.selectedOption = null;
      this.selectedOutcome = null;
      this.isAnswered = false;
      this.elapsedBeforePause = 0;
      this.questionStartTime = Date.now();

      this.renderQuestion(q);
    }

    renderQuestion(q) {
      const stage = document.getElementById('mm-quiz-stage');
      const bannerWrap = document.getElementById('mm-question-banner-wrap');
      const queryTypeEl = document.getElementById('mm-query-type');
      const refPill = document.getElementById('mm-ref-pill');
      const colOptions = document.getElementById('mm-col-options');
      const feedbackBox = document.getElementById('mm-feedback-box');
      const statsBar = document.getElementById('mm-quiz-stats-bar');
      const btnNext = document.getElementById('mm-btn-next-question');
      const btnViewMap = document.getElementById('mm-btn-view-map');

      const isUpstream = q.refSide === 'right';
      stage.classList.remove('ref-left', 'ref-right');
      stage.classList.add(isUpstream ? 'ref-right' : 'ref-left');

      if (bannerWrap) {
        let alignClass = 'align-left';
        if (q.queryType === 'Furthest Upstream?') {
          alignClass = 'align-left';
        } else if (q.queryType === 'Closest Upstream?') {
          alignClass = 'align-mid-right';
        } else if (q.queryType === 'Closest Downstream?') {
          alignClass = 'align-mid-left';
        } else if (q.queryType === 'Furthest Downstream?') {
          alignClass = 'align-right';
        } else {
          alignClass = isUpstream ? 'align-left' : 'align-right';
        }
        bannerWrap.className = 'mm-quiz-question-banner-wrap ' + alignClass;
      }

      if (queryTypeEl) queryTypeEl.textContent = q.queryType;
      if (refPill) refPill.textContent = q.refNode.text;

      if (feedbackBox) {
        feedbackBox.className = 'mm-quiz-feedback-box';
        feedbackBox.innerHTML = '';
      }

      if (statsBar) {
        statsBar.classList.remove('active');
      }

      if (btnNext) {
        btnNext.disabled = true;
      }
      if (btnViewMap) {
        btnViewMap.disabled = true;
      }

      this.updateRetryUI();

      colOptions.innerHTML = '';
      q.options.forEach((opt, idx) => {
        const optEl = document.createElement('div');
        optEl.className = 'mm-quiz-pill mm-quiz-option';
        optEl.id = 'mm-opt-' + idx;
        optEl.dataset.idx = idx;
        optEl.innerHTML = `
          <span class="mm-opt-text">${opt.text}</span>
          <span class="mm-quiz-opt-tag" id="mm-opt-tag-${idx}" style="display: none;"></span>
        `;
        optEl.addEventListener('click', () => this.handleOptionClick(idx));
        colOptions.appendChild(optEl);
      });

      setTimeout(() => this.drawMermaidConnectors(), 40);
    }

    /**
     * Restore Question View when returning to game
     */
    restoreQuestionView() {
      if (!this.currentQuestion) return;
      const q = this.currentQuestion;

      const stage = document.getElementById('mm-quiz-stage');
      const bannerWrap = document.getElementById('mm-question-banner-wrap');
      const queryTypeEl = document.getElementById('mm-query-type');
      const refPill = document.getElementById('mm-ref-pill');
      const colOptions = document.getElementById('mm-col-options');
      const feedbackBox = document.getElementById('mm-feedback-box');
      const statsBar = document.getElementById('mm-quiz-stats-bar');
      const btnNext = document.getElementById('mm-btn-next-question');
      const btnViewMap = document.getElementById('mm-btn-view-map');

      if (!stage || !colOptions) return;

      const isUpstream = q.refSide === 'right';
      stage.classList.remove('ref-left', 'ref-right');
      stage.classList.add(isUpstream ? 'ref-right' : 'ref-left');

      if (bannerWrap) {
        let alignClass = 'align-left';
        if (q.queryType === 'Furthest Upstream?') {
          alignClass = 'align-left';
        } else if (q.queryType === 'Closest Upstream?') {
          alignClass = 'align-mid-right';
        } else if (q.queryType === 'Closest Downstream?') {
          alignClass = 'align-mid-left';
        } else if (q.queryType === 'Furthest Downstream?') {
          alignClass = 'align-right';
        } else {
          alignClass = isUpstream ? 'align-left' : 'align-right';
        }
        bannerWrap.className = 'mm-quiz-question-banner-wrap ' + alignClass;
      }

      if (queryTypeEl) queryTypeEl.textContent = q.queryType;
      if (refPill) refPill.textContent = q.refNode.text;

      colOptions.innerHTML = '';
      q.options.forEach((opt, idx) => {
        const optEl = document.createElement('div');
        optEl.className = 'mm-quiz-pill mm-quiz-option';
        optEl.id = 'mm-opt-' + idx;
        optEl.dataset.idx = idx;
        optEl.innerHTML = `
          <span class="mm-opt-text">${opt.text}</span>
          <span class="mm-quiz-opt-tag" id="mm-opt-tag-${idx}" style="display: none;"></span>
        `;
        optEl.addEventListener('click', () => this.handleOptionClick(idx));
        colOptions.appendChild(optEl);
      });

      if (this.isAnswered && this.selectedOptionIdx !== null) {
        // Re-apply answered state
        const selectedIdx = this.selectedOptionIdx;
        const outcome = this.selectedOutcome;
        const selectedOpt = this.selectedOption;

        q.options.forEach((_, idx) => {
          const el = document.getElementById('mm-opt-' + idx);
          if (el) el.classList.add('disabled');
        });

        const selectedEl = document.getElementById('mm-opt-' + selectedIdx);
        const selectedTag = document.getElementById('mm-opt-tag-' + selectedIdx);

        let feedbackText = '';
        let feedbackClass = '';

        if (outcome === 'target' || outcome === 'correct') {
          if (selectedEl) selectedEl.classList.add('opt-correct');
          if (selectedTag) {
            selectedTag.className = 'mm-quiz-opt-tag tag-correct';
            selectedTag.textContent = 'Correct';
            selectedTag.style.display = 'inline-block';
          }
          feedbackClass = 'feedback-correct';
          feedbackText = `<strong>Correct:</strong> "${selectedOpt.text}" is the <strong>${q.queryType.replace('?', '')}</strong> relative to "${q.refNode.text}".`;
        } else if (outcome === 'partial') {
          if (selectedEl) selectedEl.classList.add('opt-partial');
          if (selectedTag) {
            selectedTag.className = 'mm-quiz-opt-tag tag-partial';
            selectedTag.textContent = 'Same Branch';
            selectedTag.style.display = 'inline-block';
          }
          feedbackClass = 'feedback-partial';
          feedbackText = `<strong>Partial Credit:</strong> "${selectedOpt.text}" is on the same lineage branch, but not the ${q.queryType.replace('?', '')}. The ideal answer was <strong>"${q.targetNode.text}"</strong>.`;
        } else {
          if (selectedEl) selectedEl.classList.add('opt-incorrect');
          if (selectedTag) {
            selectedTag.className = 'mm-quiz-opt-tag tag-incorrect';
            selectedTag.textContent = 'Incorrect';
            selectedTag.style.display = 'inline-block';
          }
          feedbackClass = 'feedback-incorrect';
          feedbackText = `<strong>Incorrect:</strong> "${selectedOpt.text}" belongs to a different conceptual branch or level. The correct answer was <strong>"${q.targetNode.text}"</strong>.`;
        }

        if (outcome !== 'target' && outcome !== 'correct') {
          const targetIdx = q.options.findIndex(o => o.type === 'target');
          if (targetIdx !== -1) {
            const targetEl = document.getElementById('mm-opt-' + targetIdx);
            const targetTag = document.getElementById('mm-opt-tag-' + targetIdx);
            if (targetEl) targetEl.classList.add('opt-target-hint');
            if (targetTag) {
              targetTag.className = 'mm-quiz-opt-tag tag-ideal';
              targetTag.textContent = 'Target';
              targetTag.style.display = 'inline-block';
            }
          }
        }

        if (feedbackBox) {
          feedbackBox.className = 'mm-quiz-feedback-box active ' + feedbackClass;
          feedbackBox.innerHTML = feedbackText;
        }

        if (statsBar) {
          statsBar.classList.add('active');
        }

        if (btnNext) btnNext.disabled = false;
        if (btnViewMap) btnViewMap.disabled = false;
        this.updateRetryUI();

        const normalizedOutcome = outcome === 'target' ? 'correct' : outcome;
        setTimeout(() => this.drawMermaidConnectors(normalizedOutcome, selectedIdx), 50);
      } else {
        if (statsBar) statsBar.classList.remove('active');
        if (btnNext) btnNext.disabled = true;
        if (btnViewMap) btnViewMap.disabled = true;
        this.updateRetryUI();
        setTimeout(() => this.drawMermaidConnectors(), 50);
      }
    }

    /**
     * SVG Mermaid Connector Drawing
     */
    drawMermaidConnectors(activeOutcome = null, activeIdx = null) {
      const svg = document.getElementById('mm-quiz-svg');
      const stage = document.getElementById('mm-quiz-stage');
      const refPill = document.getElementById('mm-ref-pill');
      if (!svg || !stage || !refPill || !this.currentQuestion) return;

      const stageRect = stage.getBoundingClientRect();
      const refRect = refPill.getBoundingClientRect();

      const isRefRight = this.currentQuestion.refSide === 'right';
      
      const x1 = isRefRight 
        ? (refRect.left - stageRect.left) 
        : (refRect.right - stageRect.left);
      const y1 = (refRect.top - stageRect.top) + (refRect.height / 2);

      let pathsHtml = '';

      this.currentQuestion.options.forEach((opt, idx) => {
        const optEl = document.getElementById('mm-opt-' + idx);
        if (!optEl) return;
        const optRect = optEl.getBoundingClientRect();

        const x2 = isRefRight
          ? (optRect.right - stageRect.left)
          : (optRect.left - stageRect.left);
        const y2 = (optRect.top - stageRect.top) + (optRect.height / 2);

        const dx = Math.abs(x2 - x1) * 0.55;
        const cx1 = isRefRight ? (x1 - dx) : (x1 + dx);
        const cx2 = isRefRight ? (x2 + dx) : (x2 - dx);

        const d = `M ${x1},${y1} C ${cx1},${y1} ${cx2},${y2} ${x2},${y2}`;

        let lineClass = 'mm-quiz-connector';
        if (activeIdx !== null) {
          if (idx === activeIdx) {
            if (activeOutcome === 'correct') lineClass += ' line-correct';
            else if (activeOutcome === 'partial') lineClass += ' line-partial';
            else if (activeOutcome === 'incorrect') lineClass += ' line-incorrect';
          } else if (opt.type === 'target' && activeOutcome !== 'correct') {
            lineClass += ' line-target-hint';
          }
        }

        pathsHtml += `<path id="mm-connector-${idx}" class="${lineClass}" d="${d}" />`;
      });

      svg.innerHTML = pathsHtml;
    }

    /**
     * Handle option selection & evaluation
     */
    handleOptionClick(selectedIdx) {
      if (this.isAnswered || !this.currentQuestion) return;
      this.isAnswered = true;

      const timeTakenMs = Date.now() - this.questionStartTime;
      const q = this.currentQuestion;
      const selectedOpt = q.options[selectedIdx];
      const outcome = selectedOpt.type;

      this.selectedOptionIdx = selectedIdx;
      this.selectedOption = selectedOpt;
      this.selectedOutcome = outcome;

      q.options.forEach((_, idx) => {
        const el = document.getElementById('mm-opt-' + idx);
        if (el) el.classList.add('disabled');
      });

      const selectedEl = document.getElementById('mm-opt-' + selectedIdx);
      const selectedTag = document.getElementById('mm-opt-tag-' + selectedIdx);

      let feedbackText = '';
      let feedbackClass = '';

      if (outcome === 'target') {
        selectedEl.classList.add('opt-correct');
        selectedTag.className = 'mm-quiz-opt-tag tag-correct';
        selectedTag.textContent = 'Correct';
        selectedTag.style.display = 'inline-block';

        feedbackClass = 'feedback-correct';
        feedbackText = `<strong>Correct:</strong> "${selectedOpt.text}" is the <strong>${q.queryType.replace('?', '')}</strong> relative to "${q.refNode.text}".`;
      } 
      else if (outcome === 'partial') {
        selectedEl.classList.add('opt-partial');
        selectedTag.className = 'mm-quiz-opt-tag tag-partial';
        selectedTag.textContent = 'Same Branch';
        selectedTag.style.display = 'inline-block';

        feedbackClass = 'feedback-partial';
        feedbackText = `<strong>Partial Credit:</strong> "${selectedOpt.text}" is on the same lineage branch, but not the ${q.queryType.replace('?', '')}. The ideal answer was <strong>"${q.targetNode.text}"</strong>.`;
      } 
      else {
        selectedEl.classList.add('opt-incorrect');
        selectedTag.className = 'mm-quiz-opt-tag tag-incorrect';
        selectedTag.textContent = 'Incorrect';
        selectedTag.style.display = 'inline-block';

        feedbackClass = 'feedback-incorrect';
        feedbackText = `<strong>Incorrect:</strong> "${selectedOpt.text}" belongs to a different conceptual branch or level. The correct answer was <strong>"${q.targetNode.text}"</strong>.`;
      }

      if (outcome !== 'target') {
        const targetIdx = q.options.findIndex(o => o.type === 'target');
        if (targetIdx !== -1) {
          const targetEl = document.getElementById('mm-opt-' + targetIdx);
          const targetTag = document.getElementById('mm-opt-tag-' + targetIdx);
          if (targetEl) targetEl.classList.add('opt-target-hint');
          if (targetTag) {
            targetTag.className = 'mm-quiz-opt-tag tag-ideal';
            targetTag.textContent = 'Target';
            targetTag.style.display = 'inline-block';
          }
        }
      }

      const feedbackBox = document.getElementById('mm-feedback-box');
      if (feedbackBox) {
        feedbackBox.className = 'mm-quiz-feedback-box active ' + feedbackClass;
        feedbackBox.innerHTML = feedbackText;
      }

      const statsBar = document.getElementById('mm-quiz-stats-bar');
      if (statsBar) {
        statsBar.classList.add('active');
      }

      const btnNext = document.getElementById('mm-btn-next-question');
      if (btnNext) {
        btnNext.disabled = false;
      }
      const btnViewMap = document.getElementById('mm-btn-view-map');
      if (btnViewMap) {
        btnViewMap.disabled = false;
      }

      this.updateRetryUI();

      const normalizedOutcome = outcome === 'target' ? 'correct' : outcome;
      this.drawMermaidConnectors(normalizedOutcome, selectedIdx);
      this.recordOutcome(q, selectedOpt, normalizedOutcome, timeTakenMs);
    }

    recordOutcome(q, selectedOpt, outcome, timeMs) {
      this.stats.totalSeen++;
      if (outcome === 'correct') {
        this.stats.totalCorrect++;
        this.stats.timesCorrect.push(timeMs);
      } else if (outcome === 'partial') {
        this.stats.totalPartial++;
        this.stats.timesPartial.push(timeMs);
      } else {
        this.stats.totalIncorrect++;
        this.stats.timesIncorrect.push(timeMs);
      }

      const mapId = this.currentMapInfo ? this.currentMapInfo.id : 'unknown';
      if (!this.stats.mapStats[mapId]) {
        this.stats.mapStats[mapId] = {
          title: this.currentMapInfo ? this.currentMapInfo.title : 'Mind Map',
          path: this.currentMapInfo ? this.currentMapInfo.path : '',
          seen: 0,
          correct: 0,
          partial: 0,
          incorrect: 0
        };
      }
      this.stats.mapStats[mapId].seen++;
      if (outcome === 'correct') this.stats.mapStats[mapId].correct++;
      else if (outcome === 'partial') this.stats.mapStats[mapId].partial++;
      else this.stats.mapStats[mapId].incorrect++;

      this.stats.exposureLog.unshift({
        id: 'exp-' + Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: new Date().toLocaleDateString(),
        mapId: mapId,
        mapTitle: this.currentMapInfo ? this.currentMapInfo.title : 'Mind Map',
        refId: q.refNode.id,
        refText: q.refNode.text,
        queryType: q.queryType,
        chosenText: selectedOpt.text,
        targetText: q.targetNode.text,
        outcome: outcome,
        timeMs: timeMs
      });

      if (this.stats.exposureLog.length > 200) {
        this.stats.exposureLog.pop();
      }

      this.saveStats();
      this.updateStatsDisplay();
    }

    /**
     * Clear any active demonstration animation timers
     */
    clearAnimationTimers() {
      if (this.activeAnimationTimers && this.activeAnimationTimers.length > 0) {
        this.activeAnimationTimers.forEach(id => clearTimeout(id));
        this.activeAnimationTimers = [];
      }
    }

    /**
     * View on Mind Map:
     * 1. Close game modal view.
     * 2. Fully collapse mind map to either reference concept or target, whichever is more upstream.
     * 3. Step-by-step animate the necessary simulated clicks that navigate to the destination concepts.
     * 4. Highlight concept roles (Ref, Target, User Pick) and frame neatly on canvas with Playback HUD.
     */
    viewOnMindMap() {
      if (!this.currentQuestion || !this.selectedOption) return;
      this.closeQuiz();
      this.isViewingOnMap = true;
      this.runMindMapDemonstration();
    }

    /**
     * Replay the step-by-step mind map navigation animation
     */
    replayMindMapAnimation() {
      if (!this.currentQuestion || !this.selectedOption) return;
      this.runMindMapDemonstration();
    }

    /**
     * Execute the full mind map demonstration flow:
     * 1. Immediately open the concept-to-target path and collapse other branches.
     * 2. Center and smoothly frame the path in the viewport.
     * 3. Apply a 2-cycle lavender pulse to the respective pills and connecting SVG paths.
     * 4. Display the compact, centered Playback HUD (Ref ➔ Target).
     */
    runMindMapDemonstration() {
      this.clearAnimationTimers();
      this.cleanupMindMapHighlights();

      const hud = document.getElementById('mm-map-playback-hud');
      if (hud) hud.style.display = 'none';

      const q = this.currentQuestion;
      const target = q ? q.targetNode : null;
      const ref = q ? q.refNode : null;

      if (!ref || !target) return;

      const bridge = this.bridge || window.MindMapBridge || null;
      const collapsedSet = bridge ? bridge.collapsedNodes : (window.collapsedNodes || null);

      // Identify Lowest Common Ancestor (LCA) and all nodes along the path
      const refLineage = [...ref.ancestorIds, ref.id];
      const targetLineage = [...target.ancestorIds, target.id];
      const commonAncestors = refLineage.filter(id => targetLineage.includes(id));
      const lcaId = commonAncestors.length > 0 ? commonAncestors[commonAncestors.length - 1] : null;
      const lcaNode = lcaId ? this.nodesById.get(lcaId) : null;

      // Collect all node IDs needed along the concept-to-target path
      const pathNodeIds = new Set();
      const pathSegments = []; // array of [parentId, childId] pairs

      // Nodes leading from LCA to ref
      let curr = ref;
      while (curr && curr.id !== lcaId) {
        pathNodeIds.add(curr.id);
        if (curr.parentId) {
          pathSegments.push([curr.parentId, curr.id]);
          curr = this.nodesById.get(curr.parentId);
        } else {
          break;
        }
      }

      // Nodes leading from LCA to target
      curr = target;
      while (curr && curr.id !== lcaId) {
        pathNodeIds.add(curr.id);
        if (curr.parentId) {
          pathSegments.push([curr.parentId, curr.id]);
          curr = this.nodesById.get(curr.parentId);
        } else {
          break;
        }
      }

      if (lcaNode) {
        pathNodeIds.add(lcaNode.id);
      }

      // Ancestor nodes leading from root to LCA/path must be kept uncollapsed
      const ancestorsToKeepOpen = new Set();
      ref.ancestorIds.forEach(id => ancestorsToKeepOpen.add(id));
      target.ancestorIds.forEach(id => ancestorsToKeepOpen.add(id));

      // 1. Immediately open the concept-to-target path and collapse everything else
      const mapRoot = (bridge && bridge.data) ? bridge.data : window.mindMapData;
      if (mapRoot && collapsedSet) {
        const collapseAllExceptPath = (node) => {
          if (node.children && node.children.length > 0) {
            // Keep open if it's an ancestor needed to reach ref or target
            if (ancestorsToKeepOpen.has(node.id)) {
              collapsedSet.delete(node.id);
            } else {
              collapsedSet.add(node.id);
            }
            node.children.forEach(collapseAllExceptPath);
          }
        };

        collapseAllExceptPath(mapRoot);
      }

      // Re-render host mind map immediately with the path open
      if (bridge && typeof bridge.render === 'function') {
        bridge.render();
      } else if (typeof window.renderMindMap === 'function') {
        window.renderMindMap();
      }

      const findDomEl = (nodeObj) => {
        if (!nodeObj) return null;
        if (nodeObj.raw && nodeObj.raw.domEl) return nodeObj.raw.domEl;
        return document.querySelector(`[data-id="${nodeObj.id}"]`) ||
               document.getElementById('node-' + nodeObj.id) || 
               Array.from(document.querySelectorAll('.node')).find(el => el.textContent.trim().startsWith(nodeObj.text));
      };

      // 2. Smoothly zoom and frame the concept-to-target path in viewport
      const pathNodesList = Array.from(pathNodeIds).map(id => this.nodesById.get(id)).filter(Boolean);
      const rawNodes = pathNodesList.map(n => n.raw).filter(Boolean);

      const framePathInView = () => {
        if (rawNodes.length === 0) return;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        const currScale = (bridge && typeof bridge.getScale === 'function') ? bridge.getScale() : (window.scale || 1.0);

        rawNodes.forEach(n => {
          if (n.x !== undefined && n.y !== undefined) {
            const domNode = n.domEl || findDomEl(n);
            const w = domNode ? (domNode.getBoundingClientRect().width / currScale) : 190;
            const h = 46;
            if (n.x < minX) minX = n.x;
            if (n.x + w > maxX) maxX = n.x + w;
            if (n.y - h/2 < minY) minY = n.y - h/2;
            if (n.y + h/2 > maxY) maxY = n.y + h/2;
          }
        });

        if (minX !== Infinity && maxX !== -Infinity) {
          const padding = 140;
          const availW = window.innerWidth - (padding * 2);
          const availH = window.innerHeight - (padding * 2) - 70; // room for bottom HUD

          const contentW = Math.max(180, maxX - minX);
          const contentH = Math.max(90, maxY - minY);

          let newScale = Math.min(availW / contentW, availH / contentH);
          newScale = Math.max(0.45, Math.min(1.15, newScale));

          const finalTx = (window.innerWidth / 2) - (((minX + maxX) / 2) * newScale);
          const finalTy = ((window.innerHeight - 35) / 2) - (((minY + maxY) / 2) * newScale);

          if (bridge && typeof bridge.setTransform === 'function') {
            bridge.setTransform(newScale, finalTx, finalTy, true);
          } else if (typeof window.updateTransform === 'function') {
            window.scale = newScale;
            window.translateX = finalTx;
            window.translateY = finalTy;
            window.updateTransform(true);
          }
        }
      };

      framePathInView();
      const refitTimer = setTimeout(framePathInView, 60);
      this.activeAnimationTimers.push(refitTimer);

      // 3. Apply persistent Lavender borders and highlight to all pills on the path
      pathNodesList.forEach(nodeObj => {
        const el = findDomEl(nodeObj);
        if (el) {
          el.classList.add('mindmap-node-path-highlight');
        }
      });

      // Also apply primary role classes
      const refEl = findDomEl(ref);
      const targetEl = findDomEl(target);
      if (refEl) refEl.classList.add('mindmap-quiz-node-ref');
      if (targetEl) {
        if (this.selectedOutcome === 'target' || this.selectedOutcome === 'correct') {
          targetEl.classList.add('mindmap-quiz-node-correct');
        } else {
          targetEl.classList.add('mindmap-quiz-node-target');
        }
      }

      // Highlight connecting SVG paths in persistent lavender
      const applyPathHighlight = () => {
        pathSegments.forEach(([fromId, toId]) => {
          const pathEl = document.querySelector(`path[data-from="${fromId}"][data-to="${toId}"]`);
          if (pathEl) {
            pathEl.classList.add('mindmap-path-highlight');
          }
        });
      };

      applyPathHighlight();
      setTimeout(applyPathHighlight, 40);

      // 4. Display the floating Playback HUD
      this.renderPlaybackHud();
    }

    /**
     * Display the floating Playback HUD with concept tags and centered controls
     */
    renderPlaybackHud() {
      const hud = document.getElementById('mm-map-playback-hud');
      const summaryText = document.getElementById('mm-hud-summary-text');
      if (!hud || !this.currentQuestion) return;

      const q = this.currentQuestion;
      const ref = q.refNode;
      const target = q.targetNode;

      if (summaryText) {
        summaryText.innerHTML = `
          <span>Ref:</span> <span class="hud-tag-ref">${ref ? ref.text : ''}</span>
          <span>➔ Target:</span> <span class="hud-tag-target">${target ? target.text : ''}</span>
        `;
      }

      hud.style.display = 'inline-flex';
    }

    /**
     * Return back to quiz game modal from Mind Map view
     */
    returnToGameFromMindMap() {
      this.clearAnimationTimers();
      const hud = document.getElementById('mm-map-playback-hud');
      if (hud) hud.style.display = 'none';
      this.cleanupMindMapHighlights();
      this.openQuiz();
    }

    /**
     * Remove all mind map quiz highlights from DOM
     */
    cleanupMindMapHighlights() {
      document.querySelectorAll('.mindmap-node-path-highlight, .mindmap-quiz-node-ref, .mindmap-quiz-node-correct, .mindmap-quiz-node-partial, .mindmap-quiz-node-incorrect, .mindmap-quiz-node-target').forEach(el => {
        el.classList.remove(
          'mindmap-node-path-highlight',
          'mindmap-quiz-node-ref',
          'mindmap-quiz-node-correct',
          'mindmap-quiz-node-partial',
          'mindmap-quiz-node-incorrect',
          'mindmap-quiz-node-target'
        );
      });
      document.querySelectorAll('.mindmap-path-highlight').forEach(el => {
        el.classList.remove('mindmap-path-highlight');
      });
    }

    /**
     * Update Live HUD counters
     */
    updateStatsDisplay() {
      const seenEl = document.getElementById('stat-total-seen');
      const correctEl = document.getElementById('stat-correct');
      const partialEl = document.getElementById('stat-partial');
      const accEl = document.getElementById('stat-accuracy');
      const avgTimeEl = document.getElementById('stat-avg-time');

      const total = this.stats.totalSeen;
      const c = this.stats.totalCorrect;
      const p = this.stats.totalPartial;

      const cPct = total > 0 ? Math.round((c / total) * 100) : 0;
      const pPct = total > 0 ? Math.round((p / total) * 100) : 0;
      const accPct = total > 0 ? Math.round(((c + p) / total) * 100) : 0;

      const allTimes = [...this.stats.timesCorrect, ...this.stats.timesPartial, ...this.stats.timesIncorrect];
      const avgTime = allTimes.length > 0 ? (allTimes.reduce((a, b) => a + b, 0) / allTimes.length / 1000).toFixed(1) : '0.0';

      if (seenEl) seenEl.textContent = total;
      if (correctEl) correctEl.textContent = `${c} (${cPct}%)`;
      if (partialEl) partialEl.textContent = `${p} (${pPct}%)`;
      if (accEl) accEl.textContent = `${accPct}%`;
      if (avgTimeEl) avgTimeEl.textContent = avgTime + 's';
    }

    /**
     * Render Stats Drawer Details
     */
    renderDrawerContent() {
      const calcAvg = (arr) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length / 1000).toFixed(1) + 's' : '0.0s';
      
      const tcEl = document.getElementById('drawer-time-correct');
      const tpEl = document.getElementById('drawer-time-partial');
      const tiEl = document.getElementById('drawer-time-incorrect');

      const ccEl = document.getElementById('drawer-count-correct');
      const cpEl = document.getElementById('drawer-count-partial');
      const ciEl = document.getElementById('drawer-count-incorrect');

      if (tcEl) tcEl.textContent = calcAvg(this.stats.timesCorrect);
      if (tpEl) tpEl.textContent = calcAvg(this.stats.timesPartial);
      if (tiEl) tiEl.textContent = calcAvg(this.stats.timesIncorrect);

      if (ccEl) ccEl.textContent = this.stats.totalCorrect;
      if (cpEl) cpEl.textContent = this.stats.totalPartial;
      if (ciEl) ciEl.textContent = this.stats.totalIncorrect;

      // Render Categorized Sections in Lecture then Lab order
      const container = document.getElementById('mm-drawer-sections-container');
      if (container) {
        container.innerHTML = '';
        MIND_MAP_SECTIONS.forEach(sec => {
          const secWrapper = document.createElement('div');
          secWrapper.style.marginBottom = '12px';

          const secTitle = document.createElement('div');
          secTitle.className = 'mm-drawer-subsection-title';
          secTitle.textContent = sec.section;
          secWrapper.appendChild(secTitle);

          const table = document.createElement('table');
          table.className = 'mm-maps-table';
          table.innerHTML = `
            <thead>
              <tr><th>Mind Map</th><th class="th-num th-attempts">Attempts</th><th class="th-num th-correct">Correct %</th></tr>
            </thead>
            <tbody>
              ${sec.maps.map(item => {
                const mapTitle = stripLNumber(item.rawTitle);
                const mapData = this.stats.mapStats[item.id] || { seen: 0, correct: 0, partial: 0 };
                const acc = mapData.seen > 0 ? Math.round(((mapData.correct + mapData.partial) / mapData.seen) * 100) + '%' : '-';
                const isCurrent = this.currentMapInfo && this.currentMapInfo.id === item.id;
                const encodedPayload = this.encodeStats(this.stats);
                const fullHref = `${item.path}#mmq=${encodedPayload}`;
                return `
                  <tr>
                    <td>
                      <a href="${fullHref}" data-path="${item.path}" class="mm-map-link" title="Open ${mapTitle}">${mapTitle}</a>
                      ${isCurrent ? '<span class="mm-map-tag-current">Current</span>' : ''}
                    </td>
                    <td class="td-num">${mapData.seen}</td>
                    <td class="td-num"><strong>${acc}</strong></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          `;
          secWrapper.appendChild(table);
          container.appendChild(secWrapper);
        });

        // Ensure latest stats are encoded and saved on link click
        container.querySelectorAll('.mm-map-link').forEach(link => {
          link.addEventListener('click', (e) => {
            this.saveStats();
            const basePath = link.getAttribute('data-path') || link.getAttribute('href').split('#')[0];
            const encodedPayload = this.encodeStats(this.stats);
            link.href = `${basePath}#mmq=${encodedPayload}`;
          });
        });
      }

      // Exposure Log List
      const logList = document.getElementById('mm-drawer-log-list');
      const logCountEl = document.getElementById('drawer-log-count');
      if (logCountEl) logCountEl.textContent = this.stats.exposureLog.length;

      if (logList) {
        if (this.stats.exposureLog.length === 0) {
          logList.innerHTML = '<div style="color: #94a3b8; font-size: 11px; text-align: center; padding: 10px;">No questions answered yet.</div>';
        } else {
          logList.innerHTML = this.stats.exposureLog.map(item => {
            const outcomeClass = item.outcome === 'correct' ? 'log-correct' : (item.outcome === 'partial' ? 'log-partial' : 'log-incorrect');
            const outcomeLabel = item.outcome === 'correct' ? 'Correct' : (item.outcome === 'partial' ? 'Partial' : 'Missed');
            const timeSec = (item.timeMs / 1000).toFixed(1) + 's';
            const cleanMapTitle = stripLNumber(item.mapTitle);

            return `
              <div class="mm-log-item ${outcomeClass}">
                <div class="mm-log-header">
                  <span>${item.queryType} (${item.refText})</span>
                  <span>${outcomeLabel}</span>
                </div>
                <div class="mm-log-details">
                  Selected: "${item.chosenText}" | Target: "${item.targetText}" | ${cleanMapTitle}: ${item.timestamp} | Thought Time: ${timeSec}
                </div>
              </div>
            `;
          }).join('');
        }
      }
    }

    /**
     * Export / Download Statistics as JSON
     */
    exportStatsJSON() {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.stats, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "hematology_quiz_progress_" + new Date().toISOString().slice(0, 10) + ".json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }

    /**
     * Import Statistics JSON from file
     */
    importStatsJSON(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (imported && typeof imported === 'object' && imported.totalSeen !== undefined) {
            this.stats = imported;
            this.saveStats();
            this.updateStatsDisplay();
            this.renderDrawerContent();
            alert('Progress successfully imported!');
          } else {
            alert('Invalid quiz statistics JSON format.');
          }
        } catch (err) {
          alert('Failed to parse JSON file: ' + err.message);
        }
      };
      reader.readAsText(file);
    }
  }

  function injectBrandHomeButton() {
    if (document.getElementById('mindmap-brand-home-btn')) return;
    if (!document.body) {
      window.addEventListener('DOMContentLoaded', injectBrandHomeButton);
      return;
    }

    const indexPath = 'https://www.brettmrice.com/Clinical-Hematology-Lecture/';

    const brandBtn = document.createElement('a');
    brandBtn.id = 'mindmap-brand-home-btn';
    brandBtn.className = 'mindmap-brand-home-btn discussion-brand-icon';
    brandBtn.href = indexPath;
    brandBtn.title = 'Return to Index Explorer';
    brandBtn.setAttribute('aria-label', 'Return to Index Explorer');
    brandBtn.innerHTML = `
      <svg class="discussion-brand-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 14 4 9 9 4"></polyline>
        <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
      </svg>
    `;

    const titleCard = document.getElementById('btn-open-sidebar') || document.querySelector('.top-title-card');
    if (titleCard && titleCard.parentNode) {
      titleCard.parentNode.insertBefore(brandBtn, titleCard);
    } else {
      document.body.appendChild(brandBtn);
    }
  }

  // Ensure all floating buttons have descriptive title & aria-label attributes for accessibility and tooltips
  function ensureButtonTooltips() {
    const collapseBtn = document.getElementById('btn-collapse-all');
    if (collapseBtn) {
      collapseBtn.setAttribute('title', 'Collapse All');
      collapseBtn.setAttribute('aria-label', 'Collapse All');
    }
    const expandBtn = document.getElementById('btn-expand-all');
    if (expandBtn) {
      expandBtn.setAttribute('title', 'Expand All');
      expandBtn.setAttribute('aria-label', 'Expand All');
    }
    const hyBtn = document.getElementById('btn-high-yield');
    if (hyBtn) {
      hyBtn.setAttribute('title', 'Toggle High-Yield Concepts Only');
      hyBtn.setAttribute('aria-label', 'Toggle High-Yield Concepts Only');
    }
    const quizBtn = document.getElementById('btn-quiz-me');
    if (quizBtn) {
      quizBtn.setAttribute('title', 'Launch Mind Map Quiz Game (? Me)');
      quizBtn.setAttribute('aria-label', 'Launch Mind Map Quiz Game (? Me)');
    }
    const titleBtn = document.getElementById('btn-open-sidebar');
    if (titleBtn) {
      const topicEl = document.getElementById('topic-title');
      const topicText = topicEl ? topicEl.textContent.trim() : 'Course Mind Maps';
      titleBtn.setAttribute('title', `${topicText} - Open Course Mind Maps`);
      titleBtn.setAttribute('aria-label', `${topicText} - Open Course Mind Maps`);
    }
  }

  const quizInstance = new MindMapQuiz();
  window.MindMapQuiz = quizInstance;

  document.addEventListener('DOMContentLoaded', () => {
    injectBrandHomeButton();
    ensureButtonTooltips();
    if (window.mindMapData) {
      quizInstance.init(window.mindMapData);
    }
  });

  window.addEventListener('load', () => {
    injectBrandHomeButton();
    ensureButtonTooltips();
    if (window.mindMapData && !quizInstance.treeData) {
      quizInstance.init(window.mindMapData);
    }
  });

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    injectBrandHomeButton();
    ensureButtonTooltips();
  }

})(window);
