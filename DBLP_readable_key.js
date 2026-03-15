// ==UserScript==
// @name         DBLP BibTeX: Readable Key
// @namespace    feike.tools
// @version      0.1
// @description  Replace the first line of DBLP BibTeX with a readable key like vaswani2017attention and add a copy button.
// @match        https://dblp.org/rec/*
// @match        https://dblp.uni-trier.de/rec/*
// @match        https://dblp.org/*/rec/*
// @icon         https://dblp.org/favicon.ico
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(() => {
  // ----- Options -----
  const FORCE_TYPE = "";          // set to "article" to always use @article{...}; "" to preserve original type
  const TITLE_WORDS = 1;          // number of title words to include in key (1 -> "attention", 3 -> "attentionisallyou")

  function normalize(s){
    return s
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // strip accents
      .replace(/[^a-z0-9]+/gi,' ')
      .trim()
      .replace(/\s+/g,'_')
      .toLowerCase();
  }

  function buildKey(txt){
    const authorMatch = txt.match(/author\s*=\s*\{([^}]+)\}/i);
    const yearMatch   = txt.match(/year\s*=\s*\{(\d{4})\}/i);
    const titleMatch  = txt.match(/title\s*=\s*\{([^}]+)\}/i);

    // first author last name (handles "Last, First" and "First Last")
    let last = 'author';
    if (authorMatch){
      const firstAuthor = authorMatch[1].split(/\s+and\s+/i)[0].trim();
      if (firstAuthor.includes(',')) last = firstAuthor.split(',')[0].trim();
      else {
        const parts = firstAuthor.split(/\s+/);
        last = parts[parts.length - 1];
      }
    }
    last = normalize(last).replace(/_+/g,'');

    const year = yearMatch ? yearMatch[1] : 'yyyy';

    let titlePart = 'title';
    if (titleMatch){
      const words = normalize(titleMatch[1]).split('_').filter(Boolean);
      titlePart = words.slice(0, Math.max(1, TITLE_WORDS)).join('');
    }
    return `${last}${year}${titlePart}`;
  }

  function transformBibtex(orig){
    const typeMatch = orig.match(/^@([a-zA-Z]+)\s*\{/m);
    const type = (FORCE_TYPE || (typeMatch ? typeMatch[1] : 'misc')).toLowerCase();
    const key  = buildKey(orig);
    // replace "@type{OLD_KEY," with "@type{NEW_KEY,"
    return orig.replace(/^@([a-zA-Z]+)\s*\{[^,]*,/, `@${type}{${key},`);
  }

  function enhanceNode(pre){
    const orig = pre.textContent;
    if (!/@\w+\s*\{/.test(orig) || !/author\s*=/.test(orig) || !/title\s*=/.test(orig)) return;
    const changed = transformBibtex(orig);
    if (orig === changed) return;

    // toolbar
    const bar = document.createElement('div');
    Object.assign(bar.style, { margin: '6px 0', display: 'flex', gap: '6px', alignItems: 'center' });

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy modified .bib';
    copyBtn.addEventListener('click', () => {
      const text = pre.textContent;
      if (typeof GM_setClipboard === 'function') GM_setClipboard(text, { type: 'text', mimetype: 'text/plain' });
      else navigator.clipboard?.writeText(text);
      const old = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = old), 1200);
    });

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Show original';
    let showOriginal = false;
    toggleBtn.addEventListener('click', () => {
      showOriginal = !showOriginal;
      pre.textContent = showOriginal ? orig : changed;
      toggleBtn.textContent = showOriginal ? 'Show modified' : 'Show original';
    });

    bar.appendChild(copyBtn);
    bar.appendChild(toggleBtn);
    pre.parentElement.insertBefore(bar, pre);

    // set modified content initially
    pre.textContent = changed;
  }

  const process = () => {
    document.querySelectorAll('pre, code').forEach(enhanceNode);
  };

  // initial
  process();

  // in case DBLP swaps content dynamically (e.g., view toggles)
  const mo = new MutationObserver(() => process());
  mo.observe(document.body, { childList: true, subtree: true });
})();
