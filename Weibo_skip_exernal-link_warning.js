// ==UserScript==
// @name         Weibo.cn: Skip External‑link Warning
// @namespace    https://github.com/yourname/userscripts
// @version      0.1
// @description  Auto‑redirect or rewrite sinaurl?u= links to their real targets
// @match        https://weibo.cn/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(function() {
  'use strict';

  // If we’re on the warning/redirect page itself…
  if (location.pathname === '/sinaurl' && location.search.includes('u=')) {
    const url = new URL(location.href).searchParams.get('u');
    if (url) {
      // jump straight to the decoded target
      location.replace(decodeURIComponent(url));
    }
    return;
  }

  // Otherwise, rewrite all “sinaurl?u=” links in the page
  function rewriteAll() {
    document
      .querySelectorAll('a[href*="/sinaurl?u="]')
      .forEach(a => {
        try {
          const real = new URL(a.href).searchParams.get('u');
          if (real) a.href = decodeURIComponent(real);
        } catch(e){/*ignore*/}
      });
  }

  // run initial rewrite
  rewriteAll();

  // also catch any future AJAX‑injected posts
  new MutationObserver(rewriteAll)
    .observe(document.body, { childList: true, subtree: true });

  // and hijack click on any remaining sinaurl links just in case
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href*="/sinaurl?u="]');
    if (!a) return;
    e.preventDefault();
    const real = new URL(a.href).searchParams.get('u');
    if (real) location.href = decodeURIComponent(real);
  });
})();
