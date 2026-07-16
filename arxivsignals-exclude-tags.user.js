// ==UserScript==
// @name         ArXivSignals — Exclude tags
// @namespace    https://arxivsignals.io/
// @version      1.1
// @description  Adds an "Excluded" tab to ArXivSignals: blocklist topic tags and hide every paper card that carries them. Alt+click any tag chip to exclude it.
// @match        https://arxivsignals.io/*
// @match        http://localhost:8000/*
// @match        http://localhost:8741/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const KEY = 'as_excluded_tags';

  function excluded() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  }
  function save(list) {
    localStorage.setItem(KEY, JSON.stringify([...new Set(list)].sort()));
    apply();
  }
  function addTag(slug) {
    slug = slug.trim().toLowerCase().replace(/\s+/g, '-');
    if (slug) save([...excluded(), slug]);
  }
  function removeTag(slug) {
    save(excluded().filter(s => s !== slug));
  }

  // slug from a chip href: works for "/explore?keywords=x" and "explore.html?keywords=x"
  function slugOf(a) {
    const q = (a.getAttribute('href') || '').split('?')[1];
    return q ? new URLSearchParams(q).get('keywords') : null;
  }

  /* ---------- core: hide cards whose tags hit the blocklist ---------- */
  let hiddenCount = 0;
  function setText(node, text) {
    if (node && node.textContent !== text) node.textContent = text; // avoid no-op mutations
  }
  function apply() {
    const block = new Set(excluded());
    hiddenCount = 0;
    const cards = document.querySelectorAll('article.preview-card');
    cards.forEach(card => {
      const tags = [...card.querySelectorAll('a[href*="keywords="]')].map(slugOf).filter(Boolean);
      const hit = tags.some(t => block.has(t));
      // buzz view wraps cards in a positioned div for badges — hide the wrapper too
      const wrap = card.parentElement && card.parentElement.matches('div[style*="position:relative"]')
        ? card.parentElement : card;
      wrap.style.display = hit ? 'none' : '';
      if (hit) hiddenCount++;
    });
    const shown = cards.length - hiddenCount;
    setText(document.getElementById('asx-count'), String(excluded().length));
    setText(document.getElementById('asx-hidden'), hiddenCount ? ` · ${hiddenCount} hidden` : '');
    setText(document.getElementById('asx-note'), cards.length
      ? `${shown} paper${shown === 1 ? '' : 's'} shown · ${hiddenCount} hidden on this page`
      : 'No paper cards on this page');
    updateShownBadge(shown, cards.length);
    renderList();
  }

  // Where to attach the "→ N after exclusions" badge: the page's own result
  // count — explore/summaries: header span.pill; buzz: span.buzz-count;
  // otherwise (e.g. My Feed) any small header element reading "N … papers".
  function findCountAnchor() {
    const sel = document.querySelector('span.buzz-count, main span.pill, section.card span.pill, span.pill');
    if (sel) return sel;
    const re = /\b\d[\d,]*\s+(of\s+[\d,]+\s+)?papers?\b/;
    return [...document.querySelectorAll('h1, h2, h3, header p, header span, header div, main p, main span, section p, section span, section div')]
      .find(e => !e.closest('#asx-panel') && e.id !== 'asx-shown'
        && e.childElementCount <= 4 && e.textContent.length < 140 && re.test(e.textContent)) || null;
  }

  function updateShownBadge(shown, total) {
    let badge = document.getElementById('asx-shown');
    if (!hiddenCount || !total) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      const anchor = findCountAnchor();
      if (!anchor) return;
      badge = document.createElement('span');
      badge.id = 'asx-shown';
      badge.className = anchor.className;
      badge.style.color = 'var(--teal, inherit)';
      badge.title = 'Visible papers on this page after your tag exclusions';
      anchor.after(' ', badge);
    }
    setText(badge, `→ ${shown} after exclusions`);
  }

  /* ---------- UI: nav tab + panel ---------- */
  const css = document.createElement('style');
  css.textContent = `
    #asx-panel { position: fixed; top: 64px; right: 16px; z-index: 9999; width: 300px;
      padding: 14px; display: none; box-shadow: 0 8px 30px rgba(0,0,0,.35); }
    #asx-panel.open { display: block; }
    #asx-panel h3 { margin: 0 0 4px; font-size: .95rem; }
    #asx-panel .asx-hint { font-size: .75rem; opacity: .65; margin: 0 0 10px; }
    #asx-form { display: flex; gap: 6px; margin-bottom: 10px; }
    #asx-input { flex: 1; min-width: 0; }
    #asx-list { display: flex; flex-wrap: wrap; gap: 6px; }
    #asx-list .mini-tag button { all: unset; cursor: pointer; margin-left: 5px; opacity: .6; }
    #asx-list .mini-tag button:hover { opacity: 1; }
    #asx-note { font-size: .75rem; opacity: .65; margin-top: 10px; }
    .asx-blocked { outline: 1px dashed currentColor; opacity: .55; }
  `;
  document.head.append(css);

  function renderList() {
    const box = document.getElementById('asx-list');
    if (!box) return;
    box.textContent = '';
    const list = excluded();
    if (!list.length) {
      box.textContent = 'No excluded tags yet.';
      box.style.opacity = '.6';
      return;
    }
    box.style.opacity = '';
    for (const slug of list) {
      const chip = document.createElement('span');
      chip.className = 'mini-tag keyword';
      chip.textContent = slug;
      const x = document.createElement('button');
      x.textContent = '×';
      x.title = 'Un-exclude ' + slug;
      x.addEventListener('click', () => removeTag(slug));
      chip.append(x);
      box.append(chip);
    }
  }

  function ensureUI() {
    const nav = document.querySelector('nav.top-nav');
    if (!nav || document.getElementById('asx-tab')) return;

    const tab = document.createElement('a');
    tab.id = 'asx-tab';
    tab.className = 'top-nav-link';
    tab.href = '#';
    tab.innerHTML = '🚫 Excluded (<span id="asx-count">0</span>)<span id="asx-hidden"></span>';
    tab.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('asx-panel').classList.toggle('open');
    });
    nav.append(tab);

    const panel = document.createElement('div');
    panel.id = 'asx-panel';
    panel.className = 'card';
    panel.innerHTML = `
      <h3>Excluded tags</h3>
      <p class="asx-hint">Papers carrying any of these tags are hidden.
        Tip: <b>Alt+click</b> a tag chip on any card to exclude it.</p>
      <form id="asx-form"><input id="asx-input" class="nav-search-input" type="text"
        placeholder="tag slug, e.g. llm-reasoning"><button class="a-btn" type="submit">Add</button></form>
      <div id="asx-list"></div>
      <p id="asx-note"></p>`;
    panel.querySelector('#asx-form').addEventListener('submit', e => {
      e.preventDefault();
      const input = panel.querySelector('#asx-input');
      addTag(input.value);
      input.value = '';
    });
    document.body.append(panel);
    apply();
  }

  // Alt+click a tag chip anywhere -> exclude it
  document.addEventListener('click', e => {
    if (!e.altKey) return;
    const a = e.target.closest('a[href*="keywords="]');
    if (!a || !a.classList.contains('mini-tag')) return;
    e.preventDefault();
    e.stopPropagation();
    addTag(slugOf(a) || '');
  }, true);

  /* ---------- survive SPA re-renders (Next.js / pushState) ----------
   * setTimeout, not requestAnimationFrame: rAF is throttled in background
   * tabs and some embedded browsers, which would silently stop re-applying. */
  let queued = false;
  const panelMutation = m => {
    const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
    return t && t.closest && t.closest('#asx-panel');
  };
  new MutationObserver(muts => {
    if (queued || muts.every(panelMutation)) return; // ignore our own panel updates
    queued = true;
    setTimeout(() => {
      queued = false;
      ensureUI();
      apply();
    }, 50);
  }).observe(document.documentElement, { childList: true, subtree: true });

  ensureUI();
  apply();
})();
