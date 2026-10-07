/**
 * ============================================================================
 * PORTABLE DISCUSSION "? ME" QUIZ GAME ENGINE
 * Dynamic Client-Side DOM Parsing, Viewport Prioritization & Fuzzy Live-Typing
 * ============================================================================
 */

(function () {
  'use strict';

  // Prevent multiple initializations
  if (window.__CHGH_DISCUSSION_QUIZ_LOADED__) return;
  window.__CHGH_DISCUSSION_QUIZ_LOADED__ = true;

  // Resolve relative path to shared assets
  function getSharedPath() {
    const scripts = document.querySelectorAll('script[src]');
    for (const s of scripts) {
      const src = s.getAttribute('src') || '';
      if (src.includes('discussion_quiz.js') || src.includes('discussion_mindmap.js')) {
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

  // Auto-inject CSS stylesheet if not present
  function ensureCSS() {
    const existing = document.querySelector('link[href*="discussion_quiz.css"]');
    if (!existing) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${getSharedPath()}/discussion_quiz.css?v=20261007`;
      document.head.appendChild(link);
    }
  }

  // Levenshtein Distance calculation for fuzzy matching
  function levenshteinDistance(s1, s2) {
    const a = s1 || '';
    const b = s2 || '';
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  // Normalize string for fuzzy comparison
  function cleanString(str) {
    return (str || '')
      .toLowerCase()
      .replace(/[\(\)\[\]\{\}\.,;:!?'"`~@#\$%\^&\*\+=\\|/<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Check if input is a close match to single consecutive sequence of letters (Competent Mode)
  function isCloseSingleWordMatch(inputStr, targetWord) {
    const input = (inputStr || '').toLowerCase().replace(/[^a-z]/g, '');
    const target = (targetWord || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!input || !target) return false;
    if (input === target) return true;

    // Prefix match for longer words
    if (target.length >= 5 && input.length >= 4 && target.startsWith(input)) {
      if (input.length / target.length >= 0.75) return true;
    }

    const dist = levenshteinDistance(input, target);
    if (target.length <= 4) {
      if (dist === 0) return true;
    } else if (target.length <= 6) {
      if (dist <= 1 && input.length >= 3) return true;
    } else if (target.length <= 10) {
      if (dist <= 2 && input.length >= 4) return true;
    } else {
      if (dist <= 3 && input.length >= 6) return true;
    }

    return false;
  }

  // Check if input is a close match to canonical answer (General)
  function isCloseMatch(inputStr, targetStr) {
    const input = cleanString(inputStr);
    const target = cleanString(targetStr);

    if (!input || !target) return false;
    if (input === target) return true;

    // Check parenthetical sub-parts (e.g. "Erythropoietin (EPO)" -> ["erythropoietin", "epo"])
    const rawTarget = targetStr.toLowerCase();
    const parenMatches = rawTarget.match(/\(([^)]+)\)/);
    const aliases = [target];

    if (parenMatches && parenMatches[1]) {
      const insideParen = cleanString(parenMatches[1]);
      const outsideParen = cleanString(rawTarget.replace(/\([^)]+\)/g, ' '));
      if (insideParen.length >= 2) aliases.push(insideParen);
      if (outsideParen.length >= 3) aliases.push(outsideParen);
    }

    // Check slash/dash alternates (e.g. "Iron/Ferritin", "HbSS/Sickle Cell")
    if (targetStr.includes('/') || targetStr.includes('-')) {
      const parts = targetStr.split(/[\/\-]/).map(cleanString).filter(p => p.length >= 3);
      aliases.push(...parts);
    }

    for (const alias of aliases) {
      if (input === alias) return true;

      // Prefix match if user typed >= 75% of a long word
      if (alias.length >= 5 && input.length >= 4 && alias.startsWith(input)) {
        if (input.length / alias.length >= 0.75) return true;
      }

      // Levenshtein threshold based on length
      const dist = levenshteinDistance(input, alias);
      if (alias.length <= 4) {
        if (dist === 0) return true;
      } else if (alias.length <= 6) {
        if (dist <= 1 && input.length >= 3) return true;
      } else if (alias.length <= 10) {
        if (dist <= 2 && input.length >= 4) return true;
      } else {
        if (dist <= 3 && input.length >= 6) return true;
      }
    }

    return false;
  }

  // Shuffle array utility (Fisher-Yates)
  function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /**
   * Main Quiz Application Controller
   */
  class DiscussionQuizController {
    constructor() {
      this.questions = [];
      this.currentQueue = [];
      this.currentIndex = 0;
      this.currentQuestion = null;
      this.mode = 'training'; // 'training' | 'competent'
      this.score = { correct: 0, total: 0 };
      this.isOpen = false;
      this.isAnswered = false;

      this.overlayEl = null;
      this.modalEl = null;
      this.fabBtn = null;
    }

    init() {
      ensureCSS();
      this.createFAB();
      this.initFABObserver();
      this.createModalDOM();
      this.bindKeyboardShortcuts();
    }

    // Build Floating Action Button
    createFAB() {
      if (document.getElementById('discussion-quiz-fab')) return;

      let dock = document.getElementById('discussion-fab-dock');
      if (!dock) {
        dock = document.createElement('div');
        dock.id = 'discussion-fab-dock';
        dock.className = 'discussion-fab-dock';
        dock.setAttribute('role', 'toolbar');
        dock.setAttribute('aria-label', 'Discussion Navigation and Quick Actions');
        document.body.appendChild(dock);
      }

      const btn = document.createElement('button');
      btn.id = 'discussion-quiz-fab';
      btn.className = 'discussion-quiz-fab';
      btn.setAttribute('aria-label', 'Open Quiz Me Activity');
      btn.setAttribute('title', 'Launch Discussion Quiz Me');
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="fab-icon"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg><span class="fab-text">? Me</span>`;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openQuiz();
      });

      if (dock.firstChild) {
        dock.insertBefore(btn, dock.firstChild);
      } else {
        dock.appendChild(btn);
      }
      this.fabBtn = btn;
    }

    // Visibility Observer: Quiz button perfectly mirrors Navigation button visibility in lockstep
    initFABObserver() {
      if (!this.fabBtn) return;

      const navBtn = document.getElementById('jump-to-nav-btn');
      if (navBtn) {
        const syncWithNavBtn = () => {
          if (navBtn.classList.contains('visible')) {
            this.fabBtn.classList.add('visible');
          } else {
            this.fabBtn.classList.remove('visible');
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
              this.fabBtn.classList.remove('visible');
            } else {
              this.fabBtn.classList.add('visible');
            }
          });
        }, {
          root: null,
          threshold: 0
        });
        navObserver.observe(navElement);
      } else {
        const updateVis = () => {
          if (window.scrollY > 200) {
            this.fabBtn.classList.add('visible');
          } else {
            this.fabBtn.classList.remove('visible');
          }
        };
        window.addEventListener('scroll', updateVis, { passive: true });
        window.addEventListener('resize', updateVis);
        updateVis();
      }
    }

    // Clean raw LaTeX & MathJax markdown into readable prose
    cleanLaTeX(text) {
      if (!text) return '';
      return text
        .replace(/\$\\text\{([^}]+)\}\$/g, '$1')
        .replace(/\$([^$]+)\$/g, '$1')
        .replace(/\\text\{([^}]+)\}/g, '$1')
        .replace(/\\text/g, '')
        .replace(/\\sim/g, '~')
        .replace(/\\%/g, '%')
        .replace(/\\times/g, 'x')
        .replace(/--/g, '-');
    }

    // Clean term of trailing or leading punctuation/colons
    cleanTerm(raw) {
      if (!raw) return '';
      return this.cleanLaTeX(raw)
        .replace(/^[\s\*\-\#\:\.\,\;\"\'\—\–\(\)]+/, '')
        .replace(/[\s\*\-\#\:\.\,\;\"\'\—\–\(\)]+$/, '')
        .trim();
    }

    // Validate candidate medical term
    isValidTerm(term) {
      const cleaned = this.cleanTerm(term);
      if (!cleaned || cleaned.length < 3 || cleaned.length > 55) return false;
      const lower = cleaned.toLowerCase();

      // Exclude numbers, ranges, table artifacts, percentages, laboratory units
      if (/^[\d\s\.\,\-\+\%\~\(\)\/\:\;\<\>\=\±]+$/.test(cleaned)) return false;
      if (/^\d+(\.\d+)?\s*(%|fl|pg|g\/dl|mg\/dl|u\/l|mm|cm|x\s*10)/i.test(cleaned)) return false;

      // Filter common labels, noise, and table headers
      const noise = [
        'note', 'figure', 'table', 'example', 'key point', 'summary', 'important', 
        'warning', 'tip', 'overview', 'definition', 'clinical indications', 'clinical significance',
        'diagnostic utility', 'methodology', 'reference range', 'interpretation', 'navigation',
        'diagnostic parameter', 'parameter', 'finding', 'findings', 'criteria', 'category', 'absent', 'increased', 'decreased'
      ];
      if (noise.some(n => lower === n || lower.startsWith(n + ':') || lower.endsWith(':'))) return false;
      return true;
    }

    // Extract the primary single consecutive sequence of letters (without delimiters) for Competent Mode
    extractSingleWordTarget(term) {
      if (!term) return null;
      const cleaned = this.cleanLaTeX(term)
        .replace(/[\(\)\[\]\{\}\.,;:!?'"`~@#\$%\^&\*\+=\\|/<>0-9\—\–\-_]/g, ' ')
        .trim();

      const words = cleaned.split(/\s+/).filter(w => /^[A-Za-z]{3,}$/.test(w));
      if (words.length === 0) return null;

      const genericWords = new Set([
        'and', 'the', 'for', 'with', 'from', 'into', 'that', 'this', 'type', 'types',
        'cell', 'cells', 'level', 'levels', 'rate', 'rates', 'effect', 'effects',
        'disease', 'diseases', 'syndrome', 'syndromes', 'disorder', 'disorders',
        'factor', 'factors', 'state', 'states', 'stage', 'stages', 'phase', 'phases',
        'value', 'values', 'test', 'tests', 'ratio', 'ratios', 'count', 'counts',
        'finding', 'findings', 'criteria', 'category', 'categories'
      ]);

      const contentWords = words.filter(w => !genericWords.has(w.toLowerCase()));
      const pool = contentWords.length > 0 ? contentWords : words;

      let best = pool[0];
      for (const w of pool) {
        if (w.length > best.length) {
          best = w;
        }
      }
      return best;
    }

    // Formulate a natural mid-sentence fill-in-the-blank prompt (Never first-word fill)
    createSentencePrompt(fullSentence, term) {
      const cleaned = this.cleanTerm(term);
      if (!this.isValidTerm(cleaned)) return null;

      const cleanedSentence = this.cleanLaTeX(fullSentence).replace(/\s+/g, ' ').trim();
      if (cleanedSentence.length < 35) return null;

      const lowerSent = cleanedSentence.toLowerCase();
      const lowerTerm = cleaned.toLowerCase();
      
      let searchFrom = 0;
      let validPrompt = null;

      while (true) {
        const idx = lowerSent.indexOf(lowerTerm, searchFrom);
        if (idx === -1) break;

        const prefix = cleanedSentence.substring(0, idx);
        const suffix = cleanedSentence.substring(idx + cleaned.length);

        // Context Requirements:
        // 1. Never first word fill: prefix must contain at least 1 word (length >= 4)
        // 2. Either has trailing context (suffix length >= 8) OR sentence-ending with rich preceding context (prefix >= 25)
        const isSentenceEnd = /^[\.\!\?\,\;\:]*\s*$/.test(suffix);
        if (prefix.trim().length >= 4 && (suffix.trim().length >= 8 || (isSentenceEnd && prefix.trim().length >= 25))) {
          validPrompt = `${prefix}___BLANK___${suffix}`;
          break;
        }
        searchFrom = idx + lowerTerm.length;
      }

      if (!validPrompt) return null;

      // Extract single-word target for Competent Mode and formulate in-place blank
      const singleWord = this.extractSingleWordTarget(cleaned);
      let competentPrompt = validPrompt;

      if (singleWord && singleWord.toLowerCase() !== cleaned.toLowerCase()) {
        const wordIdx = cleanedSentence.toLowerCase().indexOf(singleWord.toLowerCase());
        if (wordIdx !== -1) {
          const cPrefix = cleanedSentence.substring(0, wordIdx);
          const cSuffix = cleanedSentence.substring(wordIdx + singleWord.length);
          if (cPrefix.trim().length >= 4) {
            competentPrompt = `${cPrefix}___BLANK___${cSuffix}`;
          }
        }
      }

      return {
        prompt: validPrompt,
        competentPrompt: competentPrompt,
        singleWord: singleWord || cleaned
      };
    }

    // Parse Document DOM into Rich Quiz Questions from Author Prose & Lists
    extractQuestions() {
      const questions = [];
      const termPoolBySection = new Map();
      const allExtractedTerms = new Set();

      let currentHighLevel = 'General';
      let currentLowLevel = '';
      const root = document.querySelector('.markdown-body') || document.body;

      // Walk through headings, paragraphs, lists, blockquotes
      const candidateNodes = root.querySelectorAll('h1, h2, h3, h4, h5, p, li, blockquote');

      candidateNodes.forEach((node) => {
        const tagName = node.tagName.toLowerCase();

        // Track active two-level section headings
        if (tagName === 'h1' || tagName === 'h2') {
          const hText = node.textContent.replace(/^#+\s*/, '').replace(/^(\d+(\.\d+)*|[A-Z]\.|\b[IVXLCDM]+\.)\s*[:\-\.]?\s*/i, '').trim();
          if (hText && hText.length > 2 && !hText.toLowerCase().includes('navigation') && !hText.toLowerCase().includes('complete discussion')) {
            currentHighLevel = hText;
            currentLowLevel = '';
          }
          return;
        } else if (tagName === 'h3' || tagName === 'h4' || tagName === 'h5') {
          const subText = node.textContent.replace(/^#+\s*/, '').replace(/^(\d+(\.\d+)*|[A-Z]\.|\b[IVXLCDM]+\.)\s*[:\-\.]?\s*/i, '').trim();
          if (subText && subText.length > 2) {
            currentLowLevel = subText;
          }
          return;
        }

        const rect = node.getBoundingClientRect();
        const topPos = rect.top + window.scrollY;

        // Pattern 1: Bolded terms inside paragraphs, list items, or quotes
        const strongs = node.querySelectorAll('strong, b');
        if (strongs.length > 0) {
          const fullText = node.textContent.trim();
          strongs.forEach((sNode) => {
            const rawTerm = this.cleanTerm(sNode.textContent);
            if (this.isValidTerm(rawTerm)) {
              if (fullText.length >= 25 && fullText.length <= 450) {
                const promptObj = this.createSentencePrompt(fullText, rawTerm);
                if (promptObj) {
                  questions.push({
                    section: currentHighLevel,
                    highLevel: currentHighLevel,
                    lowLevel: currentLowLevel,
                    term: rawTerm,
                    singleWord: promptObj.singleWord,
                    prompt: promptObj.prompt,
                    competentPrompt: promptObj.competentPrompt,
                    topPos: topPos,
                    type: 'bold_term'
                  });
                  this.registerTerm(termPoolBySection, currentHighLevel, rawTerm);
                  allExtractedTerms.add(rawTerm);
                }
              }
            }
          });
        }
      });

      // Deduplicate questions by prompt & term
      const unique = [];
      const seen = new Set();
      questions.forEach((q) => {
        const key = `${q.term.toLowerCase()}|||${q.prompt}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(q);
        }
      });

      this.questions = unique;
      this.termPoolBySection = termPoolBySection;
      this.allExtractedTerms = Array.from(allExtractedTerms);
    }

    registerTerm(pool, section, term) {
      const cleaned = this.cleanTerm(term);
      if (!this.isValidTerm(cleaned)) return;
      if (!pool.has(section)) pool.set(section, new Set());
      pool.get(section).add(cleaned);
    }

    // Build Viewport-Prioritized Question Queue
    buildViewportQueue() {
      if (this.questions.length === 0) {
        this.extractQuestions();
      }

      const scrollY = window.scrollY || window.pageYOffset || 0;
      const viewportHeight = window.innerHeight || 800;
      const viewTop = scrollY - 100;
      const viewBottom = scrollY + viewportHeight + 100;

      const inViewport = [];
      const outsideViewport = [];

      this.questions.forEach((q) => {
        if (q.topPos >= viewTop && q.topPos <= viewBottom) {
          inViewport.push(q);
        } else {
          outsideViewport.push(q);
        }
      });

      // Shuffle viewport questions first, then append shuffled remainder
      const shuffledInView = shuffleArray(inViewport);
      const shuffledOutside = shuffleArray(outsideViewport);

      this.currentQueue = [...shuffledInView, ...shuffledOutside];
      this.currentIndex = 0;
    }

    // Generate 3 contextual distractors for multiple choice
    generateDistractors(targetTerm, section) {
      const candidates = [];
      const cleanTarget = cleanString(targetTerm);

      // Sibling terms from same section
      if (this.termPoolBySection && this.termPoolBySection.has(section)) {
        this.termPoolBySection.get(section).forEach((t) => {
          const ct = this.cleanTerm(t);
          if (cleanString(ct) !== cleanTarget && !candidates.includes(ct)) {
            candidates.push(ct);
          }
        });
      }

      // Fallback: document-wide terms
      if (candidates.length < 3 && this.allExtractedTerms) {
        this.allExtractedTerms.forEach((t) => {
          const ct = this.cleanTerm(t);
          if (cleanString(ct) !== cleanTarget && !candidates.includes(ct)) {
            candidates.push(ct);
          }
        });
      }

      const shuffled = shuffleArray(candidates);
      const chosen = shuffled.slice(0, 3);

      // Fallback medical placeholder distractors if document is sparse
      const fallbackMedicalTerms = [
        'Reticulocyte', 'Ferritin', 'Transferrin', 'Hemoglobin F', 
        'Myelocyte', 'Metamyelocyte', 'Megakaryocyte', 'Band Neutrophil'
      ];
      for (const fb of fallbackMedicalTerms) {
        if (chosen.length >= 3) break;
        const cleanFb = this.cleanTerm(fb);
        if (cleanString(cleanFb) !== cleanTarget && !chosen.includes(cleanFb)) {
          chosen.push(cleanFb);
        }
      }

      return chosen;
    }

    // Modal DOM Structure
    createModalDOM() {
      if (document.getElementById('discussion-quiz-overlay')) return;

      const overlay = document.createElement('div');
      overlay.id = 'discussion-quiz-overlay';
      overlay.className = 'discussion-quiz-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');

      overlay.innerHTML = `
        <div class="discussion-quiz-modal" id="discussion-quiz-modal">
          <!-- Seamless Centered Top Header -->
          <div class="quiz-modal-header">
            <div class="quiz-mode-segmented">
              <button class="quiz-mode-btn active" data-mode="training" id="quiz-btn-mode-training">Training Mode</button>
              <button class="quiz-mode-btn" data-mode="competent" id="quiz-btn-mode-competent">Competent Mode</button>
            </div>
            <button class="quiz-close-pill" id="quiz-modal-close" aria-label="Close Quiz">Close</button>
          </div>

          <!-- Body -->
          <div class="quiz-modal-body" id="quiz-modal-body">
            <!-- Dynamic Question Card Injected Here -->
          </div>

          <!-- Minimalist Footer -->
          <div class="quiz-modal-footer">
            <div class="quiz-footer-stats">
              <span>Score: <span class="quiz-stat-pill" id="quiz-stat-score">0 / 0</span></span>
              <span>•</span>
              <span id="quiz-stat-progress">Card 0 of 0</span>
            </div>
            <div class="quiz-footer-actions">
              <button class="quiz-btn-secondary" id="quiz-btn-skip">Skip</button>
              <button class="quiz-btn-primary" id="quiz-btn-next">Next &rarr;</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      this.overlayEl = overlay;
      this.modalEl = overlay.querySelector('.discussion-quiz-modal');

      // Bind Modal UI Events
      overlay.querySelector('#quiz-modal-close').addEventListener('click', () => this.closeQuiz());
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeQuiz();
      });

      overlay.querySelector('#quiz-btn-mode-training').addEventListener('click', () => this.setMode('training'));
      overlay.querySelector('#quiz-btn-mode-competent').addEventListener('click', () => this.setMode('competent'));
      overlay.querySelector('#quiz-btn-skip').addEventListener('click', () => this.skipQuestion());
      overlay.querySelector('#quiz-btn-next').addEventListener('click', () => this.nextQuestion());
    }

    bindKeyboardShortcuts() {
      window.addEventListener('keydown', (e) => {
        if (!this.isOpen) return;

        if (e.key === 'Escape') {
          e.preventDefault();
          this.closeQuiz();
          return;
        }

        // Enter key in Competent Mode: advance when answered, or reveal answer if input > 1 char
        if (e.key === 'Enter') {
          if (this.isAnswered) {
            e.preventDefault();
            this.nextQuestion();
            return;
          } else if (this.mode === 'competent') {
            const input = document.getElementById('quiz-typing-input');
            if (input && input.value.trim().length > 1) {
              e.preventDefault();
              this.revealCompetentAnswer();
              return;
            }
          }
        }

        // 1-4 shortcuts for Training Mode
        if (this.mode === 'training' && !this.isAnswered) {
          const num = parseInt(e.key, 10);
          if (num >= 1 && num <= 4) {
            const btns = this.modalEl.querySelectorAll('.quiz-option-btn');
            if (btns[num - 1]) {
              e.preventDefault();
              btns[num - 1].click();
            }
          }
        }
      });
    }

    openQuiz() {
      this.extractQuestions();
      this.buildViewportQueue();

      if (this.currentQueue.length === 0) {
        alert('No quiz content could be extracted from this document section.');
        return;
      }

      this.isOpen = true;
      this.overlayEl.classList.add('active');
      document.body.style.overflow = 'hidden';

      this.renderCurrentQuestion();
    }

    closeQuiz() {
      this.isOpen = false;
      this.overlayEl.classList.remove('active');
      document.body.style.overflow = '';
    }

    setMode(newMode) {
      if (this.mode === newMode) return;
      this.mode = newMode;

      const tBtn = document.getElementById('quiz-btn-mode-training');
      const cBtn = document.getElementById('quiz-btn-mode-competent');

      if (newMode === 'training') {
        tBtn.classList.add('active');
        cBtn.classList.remove('active');
      } else {
        cBtn.classList.add('active');
        tBtn.classList.remove('active');
      }

      // Re-render current question in new mode
      this.renderCurrentQuestion();
    }

    renderCurrentQuestion() {
      const body = document.getElementById('quiz-modal-body');
      if (!body) return;

      if (this.currentIndex >= this.currentQueue.length) {
        this.renderCompletionScreen(body);
        return;
      }

      const q = this.currentQueue[this.currentIndex];
      this.currentQuestion = q;
      this.isAnswered = false;

      // Select active prompt and target based on mode
      const activePrompt = (this.mode === 'competent' && q.competentPrompt) ? q.competentPrompt : q.prompt;
      const activeTarget = (this.mode === 'competent' && q.singleWord) ? q.singleWord : q.term;

      // Format prompt with styled blank pill
      const promptHtml = this.escapeHtml(activePrompt).replace(
        '___BLANK___',
        `<span class="quiz-blank-highlight" id="quiz-blank-slot">[ ? ]</span>`
      );

      let interactionHtml = '';

      if (this.mode === 'training') {
        const distractors = this.generateDistractors(q.term, q.section);
        const options = shuffleArray([
          { text: q.term, isCorrect: true },
          ...distractors.map(d => ({ text: d, isCorrect: false }))
        ]);

        const letters = ['A', 'B', 'C', 'D'];
        const optionsButtons = options.map((opt, idx) => `
          <button class="quiz-option-btn" data-correct="${opt.isCorrect}" data-text="${this.escapeHtml(opt.text)}">
            <span class="quiz-option-letter">${letters[idx]}</span>
            <span class="quiz-option-text">${this.escapeHtml(opt.text)}</span>
          </button>
        `).join('');

        interactionHtml = `<div class="quiz-options-grid">${optionsButtons}</div>`;
      } else {
        // Competent Mode: Live-checking Input Field (Centered Text, Single Word)
        interactionHtml = `
          <div class="quiz-typing-container">
            <div class="quiz-typing-input-wrapper">
              <input type="text" class="quiz-typing-input" id="quiz-typing-input" 
                     placeholder="Type single-word answer..." 
                     autocomplete="off" spellcheck="false" autofocus />
              <div class="quiz-typing-status-icon" id="quiz-typing-icon">✎</div>
            </div>
            <div id="quiz-reveal-container"></div>
            <div class="quiz-help-hint">
              <span>Live spelling tolerance active (single word)</span>
              <button class="quiz-hint-btn" id="quiz-btn-reveal-hint">Reveal Answer</button>
            </div>
          </div>
        `;
      }

      body.innerHTML = `
        <div class="quiz-card">
          <div class="quiz-section-header-block">
            <div class="quiz-heading-high">${this.escapeHtml(q.highLevel || q.section)}</div>
            ${q.lowLevel ? `<div class="quiz-heading-low">${this.escapeHtml(q.lowLevel)}</div>` : ''}
          </div>
          <div class="quiz-prompt-card">
            ${promptHtml}
          </div>
          ${interactionHtml}
        </div>
      `;

      // Trigger MathJax rendering if available on the rendered prompt
      if (window.MathJax && window.MathJax.typesetPromise) {
        try {
          window.MathJax.typesetPromise([body]).catch(() => {});
        } catch (e) {}
      }

      this.updateStatsDisplay();

      // Bind interaction listeners
      if (this.mode === 'training') {
        const optBtns = body.querySelectorAll('.quiz-option-btn');
        optBtns.forEach((btn) => {
          btn.addEventListener('click', () => this.handleTrainingAnswer(btn, optBtns));
        });
      } else {
        const input = document.getElementById('quiz-typing-input');
        if (input) {
          input.focus();
          input.addEventListener('input', (e) => this.handleLiveTyping(e.target.value));
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              if (this.isAnswered) {
                this.nextQuestion();
              } else if (input.value.trim().length > 1) {
                this.revealCompetentAnswer();
              }
            }
          });
        }
        const hintBtn = document.getElementById('quiz-btn-reveal-hint');
        if (hintBtn) {
          hintBtn.addEventListener('click', () => this.revealCompetentAnswer());
        }
      }
    }

    handleTrainingAnswer(selectedBtn, allBtns) {
      if (this.isAnswered) return;
      this.isAnswered = true;

      const isCorrect = selectedBtn.getAttribute('data-correct') === 'true';
      this.score.total++;

      if (isCorrect) {
        this.score.correct++;
        selectedBtn.classList.add('correct');
      } else {
        selectedBtn.classList.add('incorrect');
        // Highlight correct option
        allBtns.forEach((btn) => {
          if (btn.getAttribute('data-correct') === 'true') {
            btn.classList.add('correct');
          }
        });
      }

      // Update blank slot with full term in Training Mode
      const blankSlot = document.getElementById('quiz-blank-slot');
      if (blankSlot) {
        blankSlot.textContent = this.currentQuestion.term;
        blankSlot.classList.add('revealed');
      }

      // Disable other buttons
      allBtns.forEach(btn => btn.disabled = true);
      this.updateStatsDisplay();
    }

    handleLiveTyping(inputValue, isSubmit = false) {
      if (this.isAnswered) return;

      const target = this.currentQuestion.singleWord || this.currentQuestion.term;
      const matched = isCloseSingleWordMatch(inputValue, target);

      if (matched) {
        this.isAnswered = true;
        this.score.total++;
        this.score.correct++;

        const input = document.getElementById('quiz-typing-input');
        const icon = document.getElementById('quiz-typing-icon');
        const revealCont = document.getElementById('quiz-reveal-container');
        const blankSlot = document.getElementById('quiz-blank-slot');

        if (input) {
          input.classList.add('correct');
        }
        if (icon) {
          icon.innerHTML = '✓';
          icon.classList.add('correct');
        }
        if (blankSlot) {
          blankSlot.textContent = target;
          blankSlot.classList.add('revealed');
        }

        if (revealCont) {
          revealCont.innerHTML = `
            <div class="quiz-canonical-reveal">
              <span class="icon">✓</span>
              <span>Recognized: <strong>${this.escapeHtml(target)}</strong></span>
            </div>
          `;
        }

        this.updateStatsDisplay();
      } else if (isSubmit) {
        if (inputValue.trim().length > 1) {
          // If greater than 1 character inputted and user hits enter, activate Reveal Answer
          this.revealCompetentAnswer();
        } else if (inputValue.trim().length === 1) {
          const input = document.getElementById('quiz-typing-input');
          if (input) {
            input.style.borderColor = 'var(--quiz-incorrect-border)';
            setTimeout(() => {
              input.style.borderColor = '';
            }, 600);
          }
        }
      }
    }

    revealCompetentAnswer() {
      if (this.isAnswered) return;
      this.isAnswered = true;
      this.score.total++;

      const target = this.currentQuestion.singleWord || this.currentQuestion.term;
      const blankSlot = document.getElementById('quiz-blank-slot');
      const revealCont = document.getElementById('quiz-reveal-container');
      const input = document.getElementById('quiz-typing-input');

      if (input) input.disabled = true;
      if (blankSlot) {
        blankSlot.textContent = target;
        blankSlot.classList.add('revealed');
      }
      if (revealCont) {
        revealCont.innerHTML = `
          <div class="quiz-canonical-reveal" style="background: var(--quiz-bg-card-subtle); border-color: var(--quiz-border); color: var(--quiz-fg-default);">
            <span>Canonical Answer: <strong>${this.escapeHtml(target)}</strong></span>
          </div>
        `;
      }
      this.updateStatsDisplay();
    }

    nextQuestion() {
      if (!this.isAnswered && this.currentQuestion) {
        this.score.total++;
      }
      this.currentIndex++;
      this.renderCurrentQuestion();
    }

    skipQuestion() {
      this.nextQuestion();
    }

    renderCompletionScreen(body) {
      const pct = this.score.total > 0 ? Math.round((this.score.correct / this.score.total) * 100) : 0;
      body.innerHTML = `
        <div class="quiz-card" style="text-align: center; align-items: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 8px;">🎉</div>
          <h2 style="font-size: 22px; font-weight: 700; margin: 0 0 8px 0; color: var(--quiz-fg-default);">Discussion Section Complete!</h2>
          <p style="color: var(--quiz-fg-muted); margin: 0 0 20px 0; font-size: 14.5px;">
            You scored <strong>${this.score.correct} / ${this.score.total}</strong> (${pct}%)
          </p>
          <div style="display: flex; gap: 12px;">
            <button class="quiz-btn-secondary" id="quiz-btn-restart">Restart Viewport</button>
            <button class="quiz-btn-primary" id="quiz-btn-finish">Close Activity</button>
          </div>
        </div>
      `;

      document.getElementById('quiz-btn-restart').addEventListener('click', () => {
        this.buildViewportQueue();
        this.score = { correct: 0, total: 0 };
        this.renderCurrentQuestion();
      });

      document.getElementById('quiz-btn-finish').addEventListener('click', () => {
        this.closeQuiz();
      });
    }

    updateStatsDisplay() {
      const statScore = document.getElementById('quiz-stat-score');
      const statProg = document.getElementById('quiz-stat-progress');

      if (statScore) {
        statScore.textContent = `${this.score.correct} / ${this.score.total}`;
      }
      if (statProg) {
        const total = this.currentQueue ? this.currentQueue.length : 0;
        const cur = Math.min(this.currentIndex + 1, total);
        statProg.textContent = `Card ${cur} of ${total}`;
      }
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }

  // Instantiate and initialize on DOMContentLoaded or immediate if already ready
  const quizApp = new DiscussionQuizController();
  window.DiscussionQuiz = quizApp;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => quizApp.init());
  } else {
    quizApp.init();
  }
})();
