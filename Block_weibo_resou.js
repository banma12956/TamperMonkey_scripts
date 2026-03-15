// ==UserScript==
// @name         Weibo: Hide Hot Search (微博热搜屏蔽)
// @namespace    https://feike-helper.example
// @version      1.0.2
// @description  自动隐藏微博右侧“微博热搜/热搜榜”面板，兼容异步加载与单页路由
// @match        *://weibo.com/*
// @match        *://www.weibo.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const KEYWORDS = ['微博热搜', '热搜榜', '热搜']; // 标题关键字
  // 如果你手动观察到稳定选择器，可加到这里以加速命中
  const KNOWN_SELECTORS = [
    // 示例：'aside[aria-label="微博热搜"]',
    // 示例：'[data-module-type="pl_rightmod_realtimehot"]',
  ];

  // 避免频繁扫描
  let scheduled = false;
  const markAttr = 'data-hotsearch-hidden';

  function textIncludesHotsearch(el) {
    if (!el || !el.textContent) return false;
    const txt = el.textContent.trim();
    // 只看前几行文本更接近标题；也避免把整页里任意出现“热搜”的地方误杀
    const head = txt.split('\n').slice(0, 3).join('\n');
    return KEYWORDS.some(k => head.includes(k));
  }

  function isReasonableContainer(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect?.();
    // 右侧卡片一般宽度在 240~400px，且高度明显大于标题
    return rect && rect.width >= 200 && rect.width <= 520 && rect.height >= 120;
  }

  function findContainer(el) {
    // 向上找一个“卡片/侧栏块级容器”
    return el.closest?.(
      'aside, section, div[class*="card"], div[class*="Card"], div[class*="module"], div[class*="Module"], [role="complementary"]'
    ) || el;
  }

  function hideHotsearchOnce(root = document) {
    // 1) 先试已知选择器（如果你添加了）
    for (const sel of KNOWN_SELECTORS) {
      root.querySelectorAll(sel).forEach(box => hideBox(box));
    }

    // 2) 文本匹配标题，再向上找容器隐藏
    const candidates = Array.from(
      root.querySelectorAll('aside, section, div, h1, h2, h3, h4, span')
    ).filter(textIncludesHotsearch);

    candidates.forEach(node => {
      const box = findContainer(node);
      if (!box || box.getAttribute(markAttr) === '1') return;
      if (isReasonableContainer(box)) hideBox(box);
    });
  }

  function hideBox(box) {
    box.style.display = 'none';
    box.setAttribute(markAttr, '1');
  }

  function scheduleScan(root) {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      try { hideHotsearchOnce(root); } finally { scheduled = false; }
    });
  }

  // 初次执行
  scheduleScan(document);

  // 监听 DOM 变化（微博是 SPA，路由或右侧栏经常异步刷新）
  const mo = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) {
        scheduleScan(document);
        break;
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // 当用户切换主题或窗口尺寸时重试一次（某些布局会重渲染右侧栏）
  window.addEventListener('resize', () => scheduleScan(document));
})();
