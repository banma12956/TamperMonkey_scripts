// ==UserScript==
// @name         Copy LaTeX from Equations (fixed)
// @namespace    http://tampermonkey.net/
// @version      2.1.0
// @description  Click rendered math on ChatGPT or Claude to copy its LaTeX source
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://claude.ai/*
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /*
   * Do not scan and tag the page. Both sites are single-page applications and
   * frequently replace streamed equation nodes. Event delegation keeps working
   * even after those replacements.
   */
  const MATH_SELECTOR = [
    '.katex',
    'mjx-container',
    '.MathJax',
    '.MathJax_Display',
    '.math-inline',
    '.math-display',
    '[role="math"]',
    '[data-math]',
    'math[alttext]',
    'svg[data-latex]',
  ].join(', ');

  const style = document.createElement('style');
  style.textContent = `
    .katex, mjx-container, .MathJax, .MathJax_Display,
    .math-inline, .math-display, [role="math"], [data-math],
    math[alttext], svg[data-latex] {
      cursor: copy !important;
      border-radius: 4px;
    }

    .katex:hover, mjx-container:hover, .MathJax:hover,
    .MathJax_Display:hover, .math-inline:hover, .math-display:hover,
    [role="math"]:hover, [data-math]:hover,
    math[alttext]:hover, svg[data-latex]:hover {
      outline: 2px solid #6d5cff !important;
      background: rgba(109, 92, 255, 0.08) !important;
    }

    #latex-copy-toast-v2 {
      position: fixed;
      left: 50%;
      bottom: 28px;
      transform: translate(-50%, 18px);
      z-index: 2147483647;
      max-width: min(600px, calc(100vw - 32px));
      padding: 10px 16px;
      border: 1px solid #45475a;
      border-radius: 10px;
      background: #1e1e2e;
      color: #cdd6f4;
      box-shadow: 0 4px 24px rgba(0, 0, 0, .35);
      font: 13px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity .2s, transform .2s;
    }

    #latex-copy-toast-v2.visible {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  let toastTimer;

  function showToast(message, ok = true) {
    let toast = document.getElementById('latex-copy-toast-v2');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'latex-copy-toast-v2';
      (document.body || document.documentElement).appendChild(toast);
    }

    const preview = message.length > 140 ? `${message.slice(0, 140)}…` : message;
    toast.textContent = ok ? `✓ LaTeX copied: ${preview}` : `Could not copy: ${preview}`;
    toast.style.color = ok ? '#cdd6f4' : '#f38ba8';
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
  }

  function clean(value) {
    const result = value == null ? '' : String(value).trim();
    return result || null;
  }

  function unwrapDelimiters(value) {
    const text = clean(value);
    if (!text) return null;

    const pairs = [
      [/^\\\(([\s\S]*)\\\)$/u, 1],
      [/^\\\[([\s\S]*)\\\]$/u, 1],
      [/^\$\$([\s\S]*)\$\$$/u, 1],
      [/^\$([^$]*)\$$/u, 1],
    ];

    for (const [pattern, group] of pairs) {
      const match = text.match(pattern);
      if (match) return clean(match[group]);
    }
    return text;
  }

  function readAttribute(element, names) {
    for (const name of names) {
      const value = clean(element?.getAttribute?.(name));
      if (value) return value;
    }
    return null;
  }

  function extractLatex(start) {
    /* Site-owned attributes, including newer renderer variants. */
    let node = start;
    for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
      const value = readAttribute(node, [
        'data-math',
        'data-latex',
        'data-tex',
        'data-original',
        'data-original-text',
        'data-math-source',
        'data-latex-source',
      ]);
      if (value) return unwrapDelimiters(value);
    }

    const container =
      start.closest?.('.katex, mjx-container, .MathJax, .MathJax_Display, [role="math"]') ||
      start;

    /* KaTeX keeps the original input in its hidden MathML annotation. */
    const annotation = container.querySelector?.(
      'annotation[encoding="application/x-tex"], annotation[encoding="text/x-tex"], annotation',
    );
    const annotationValue = clean(annotation?.textContent);
    if (annotationValue) return unwrapDelimiters(annotationValue);

    /* Search descendants too: recent renderers put metadata below the wrapper. */
    const sourceSelector = [
      'math[alttext]',
      'svg[data-latex]',
      '[data-math]',
      '[data-latex]',
      '[data-tex]',
      '[data-original]',
      '[data-original-text]',
      '[data-math-source]',
      '[data-latex-source]',
    ].join(', ');
    const sourceNodes = [
      ...(container.matches?.(sourceSelector) ? [container] : []),
      ...(container.querySelectorAll?.(sourceSelector) || []),
    ];
    for (const sourceNode of sourceNodes) {
      const sourceValue = readAttribute(sourceNode, [
        'alttext',
        'data-math',
        'data-latex',
        'data-tex',
        'data-original',
        'data-original-text',
        'data-math-source',
        'data-latex-source',
      ]);
      if (sourceValue) return unwrapDelimiters(sourceValue);
    }

    /* Older MathJax versions place the source in an adjacent script node. */
    const script =
      container.querySelector?.('script[type*="math/tex"]') ||
      container.parentElement?.querySelector?.('script[type*="math/tex"]');
    const scriptValue = clean(script?.textContent);
    if (scriptValue) return scriptValue;

    /* Last resorts used by a few accessibility-oriented renderers. */
    const accessibleNode = container.querySelector?.(
      '[aria-label], math[alttext], svg > title, .sr-only, .visually-hidden',
    );
    const accessibleValue =
      readAttribute(container, ['aria-label', 'title', 'alttext']) ||
      readAttribute(accessibleNode, ['aria-label', 'title', 'alttext']) ||
      clean(accessibleNode?.textContent);
    if (accessibleValue) return unwrapDelimiters(accessibleValue);

    /* Some components retain delimited TeX in a hidden text node. */
    const text = clean(container.textContent);
    const delimited = text?.match(/\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/u);
    if (delimited) return clean(delimited[1] ?? delimited[2] ?? delimited[3]);

    return null;
  }

  function copyText(text) {
    /* Tampermonkey's clipboard API is not subject to the page's permissions. */
    try {
      GM_setClipboard(text, 'text');
      return true;
    } catch (_) {
      /* Continue to browser fallbacks. */
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position:fixed;left:-10000px;top:0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      return copied;
    } catch (_) {
      return false;
    }
  }

  document.addEventListener('click', (event) => {
    const origin = event.target instanceof Element
      ? event.target
      : event.target?.parentElement;
    const math = origin?.closest?.(MATH_SELECTOR);
    if (!math) return;

    const latex = extractLatex(math);
    if (!latex) {
      console.warn('[Copy LaTeX v2] Equation source not found.', {
        matchedElement: math,
        outerHTML: math.outerHTML,
        attributes: Object.fromEntries(
          [...math.attributes].map((attribute) => [attribute.name, attribute.value]),
        ),
      });
      showToast('the page did not expose the equation source', false);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (copyText(latex)) showToast(latex);
    else showToast('clipboard access was denied', false);
  }, true);

  console.info('[Copy LaTeX v2] Loaded. Click a highlighted equation to copy.');
}());
