// ==UserScript==
// @name         Zhihu Zhuanlan → Markdown (with LaTeX)
// @namespace    https://tampermonkey.net/
// @version      1.0.0
// @description  Add a button on Zhihu Zhuanlan posts to export the article as Markdown, preserving LaTeX formulas.
// @author       You
// @match        https://zhuanlan.zhihu.com/p/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @require      https://unpkg.com/turndown/dist/turndown.js
// @require      https://unpkg.com/turndown-plugin-gfm/dist/turndown-plugin-gfm.js
// ==/UserScript==

(function () {
  "use strict";

  // ---------- Utilities ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function sanitizeFilename(name) {
    return (name || "zhihu-article")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
  }

  function stripZhidaLinks(md) {
  const lines = md.split(/\r?\n/);
  let inFence = false;
  const reFence = /^\s*```/;
  const reHost = /zhida\.zhihu\.com/i;

  function fixLineOutsideInlineCode(s) {
    let i = 0, out = "";
    let inInline = false, openerLen = 0;

    while (i < s.length) {
      // Enter inline code (one or more backticks)
      if (!inInline && s[i] === "`") {
        let j = i;
        while (j < s.length && s[j] === "`") j++;
        openerLen = j - i;
        inInline = true;
        out += s.slice(i, j);
        i = j;
        continue;
      }
      // Exit inline code when same-length backticks appear
      if (inInline) {
        if (s.slice(i, i + openerLen) === "`".repeat(openerLen)) {
          out += "`".repeat(openerLen);
          i += openerLen;
          inInline = false;
        } else {
          out += s[i++];
        }
        continue;
      }

      // Not in inline code: look for markdown links [text](url)
      if (s[i] === "[") {
        // Ignore images: ![alt](src)
        if (i > 0 && s[i - 1] === "!") {
          out += s[i++];
          continue;
        }

        // Find matching ]
        let j = i + 1, depth = 1;
        while (j < s.length) {
          if (s[j] === "\\") { j += 2; continue; } // skip escaped char
          if (s[j] === "[") depth++;
          else if (s[j] === "]") { depth--; if (depth === 0) break; }
          j++;
        }
        if (depth !== 0) { out += s[i++]; continue; }

        const linkText = s.slice(i + 1, j);

        // Skip spaces then expect (
        let k = j + 1;
        while (k < s.length && /\s/.test(s[k])) k++;
        if (s[k] !== "(") { // not an inline link, just emit what we parsed
          out += s.slice(i, j + 1);
          i = j + 1;
          continue;
        }

        // Find matching ) for URL part
        let m = k + 1, pdepth = 1;
        while (m < s.length) {
          if (s[m] === "\\") { m += 2; continue; } // skip escaped char
          if (s[m] === "(") pdepth++;
          else if (s[m] === ")") { pdepth--; if (pdepth === 0) break; }
          m++;
        }
        if (pdepth !== 0) { out += s.slice(i); return out; }

        const url = s.slice(k + 1, m);

        if (reHost.test(url)) {
          // Strip the link: keep only the visible text
          out += linkText;
        } else {
          // Keep original link segment
          out += s.slice(i, m + 1);
        }
        i = m + 1;
        continue;
      }

      // Default: copy char
      out += s[i++];
    }

    return out;
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Toggle fenced code blocks
    if (reFence.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // Quick check: only parse lines that might contain such links
    if (line.includes("[") && line.includes("zhida.zhihu.com")) {
      lines[idx] = fixLineOutsideInlineCode(line);
    }
  }

  return lines.join("\n");
}

  function deescapeBackslashes(md) {
  // Replace all double backslashes with a single backslash
  return md.replace(/\\\\/g, "\\");
}

  function unescapeSquareBrackets(md) {
  const lines = md.split(/\r?\n/);
  let inFence = false;
  const reFence = /^\s*```/;

  function fixLineOutsideInlineCode(s) {
    let i = 0, out = "";
    let inInline = false, openerLen = 0;

    while (i < s.length) {
      // Enter inline code: one or more backticks
      if (!inInline && s[i] === "`") {
        let j = i;
        while (j < s.length && s[j] === "`") j++;
        openerLen = j - i;
        inInline = true;
        out += s.slice(i, j);
        i = j;
        continue;
      }
      // Exit inline code when same-length backticks appear
      if (inInline) {
        if (s.slice(i, i + openerLen) === "`".repeat(openerLen)) {
          out += "`".repeat(openerLen);
          i += openerLen;
          inInline = false;
        } else {
          out += s[i++];
        }
        continue;
      }
      // Outside inline code: \[ -> [, \] -> ]
      if (s[i] === "\\" && (s[i + 1] === "[" || s[i + 1] === "]")) {
        out += s[i + 1];
        i += 2;
      } else {
        out += s[i++];
      }
    }
    return out;
  }

  for (let k = 0; k < lines.length; k++) {
    const line = lines[k];

    // Toggle fenced code blocks
    if (reFence.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (line.includes("\\[") || line.includes("\\]")) {
      lines[k] = fixLineOutsideInlineCode(line);
    }
  }
  return lines.join("\n");
}

  function unescapeUnderscores(md) {
  const lines = md.split(/\r?\n/);
  let inFence = false;
  const reFence = /^\s*```/;

  function fixLineOutsideInlineCode(s) {
    // Walk the line; respect inline code spans delimited by any number of backticks
    let i = 0, out = "";
    let inInline = false, openerLen = 0;

    while (i < s.length) {
      if (!inInline && s[i] === "`") {
        // open inline code
        let j = i;
        while (j < s.length && s[j] === "`") j++;
        openerLen = j - i;
        inInline = true;
        out += s.slice(i, j);
        i = j;
        continue;
      }
      if (inInline) {
        // close inline code when same-length backticks appear
        if (s.slice(i, i + openerLen) === "`".repeat(openerLen)) {
          out += "`".repeat(openerLen);
          i += openerLen;
          inInline = false;
        } else {
          out += s[i++];
        }
        continue;
      }
      // Outside inline code: replace \_ → _
      if (s[i] === "\\" && s[i + 1] === "_") {
        out += "_";
        i += 2;
      } else {
        out += s[i++];
      }
    }
    return out;
  }

  for (let k = 0; k < lines.length; k++) {
    const line = lines[k];

    // Toggle fenced code blocks
    if (reFence.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (line.includes("\\_")) {
      lines[k] = fixLineOutsideInlineCode(line);
    }
  }
  return lines.join("\n");
}

  function normalizeNumberedHeadings(md) {
  const lines = md.split(/\r?\n/);
  let inFence = false;

  // Precompile the patterns
  const reFence = /^```/;
  const reH4 = /^###\s+(\d+\.\d+\.\d+\.\d+)([^\n]*)$/; // ### x.x.x.x ...
  const reH3 = /^###\s+(\d+\.\d+\.\d+)([^\n]*)$/; // ### x.x.x ...
  const reH2 = /^##\s+(\d+\.\d+)([^\n]*)$/;       // ## x.x ...

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Toggle code fence state
    if (reFence.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // Only modify if the line matches the pattern
    if (reH4.test(line)) {
      continue; // Don't let this line get processed again
    }

    if (reH3.test(line)) {
      lines[i] = line.replace(reH3, '## $1$2'); // ### → ##
      continue; // Don't let this line get processed again
    }

    if (reH2.test(line)) {
      lines[i] = line.replace(reH2, '# $1$2'); // ## → #
      continue;
    }
  }

  return lines.join('\n');
}

  function getTitle() {
    const sel = [
      "h1.Post-Title",
      "h1.ArticleItem-Title",
      "h1.ContentItem-title",
      'meta[property="og:title"]',
      "title",
    ];
    for (const s of sel) {
      const el = document.querySelector(s);
      if (el) {
        if (el.tagName === "META") return el.getAttribute("content") || "";
        return el.textContent.trim();
      }
    }
    return document.title.replace(/ - 知乎$/, "");
  }

  function getAuthor() {
    const metaAuthor = document.querySelector('meta[name="author"]');
    if (metaAuthor && metaAuthor.content) return metaAuthor.content.trim();

    const candidates = [
      '.AuthorInfo-head .ProfileHeader-name',
      '.AuthorInfo .AuthorInfo-head .UserLink-link',
      '.Post-Header .UserLink-link',
      '.ContentItem-meta .UserLink-link',
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) return el.textContent.trim();
    }
    return "";
  }

  function getArticleRoot() {
    // Try several known containers used by Zhihu Zhuanlan.
    const selectors = [
      ".Post-RichTextContainer .RichText.ztext", // most common
      ".RichText.ztext.Post-RichText",
      ".Post-RichText",
      "article .RichText.ztext",
      "article",
    ];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function unwrap(el) {
    // Replace element by its children (used when removing wrappers like figure)
    while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
    el.remove();
  }

  // ---------- Math restoration ----------
  // Zhihu renders math with KaTeX. KaTeX embeds the original LaTeX in:
  // <span class="katex-mathml"><math><semantics>
  //   <annotation encoding="application/x-tex"> ... </annotation>
  // </semantics></math></span>
  // We locate that and replace the rendered block with $...$ or $$...$$ accordingly.
  function replaceKatexWithTex(root) {
    // Display math first: replace the entire .katex-display node.
    const displayNodes = root.querySelectorAll("span.katex-display");
    displayNodes.forEach((display) => {
      const ann = display.querySelector('annotation[encoding="application/x-tex"]');
      if (!ann) return;
      let tex = ann.textContent || "";
      tex = tex.replace(/\u00A0/g, " "); // nbsp → space
      const wrapper = `\n\n\n${tex}\n\n\n`;
      const repl = document.createElement("span");
      repl.textContent = wrapper;
      display.replaceWith(repl);
    });

    // Inline math: .katex not inside a .katex-display
    const inlineNodes = root.querySelectorAll("span.katex");
    inlineNodes.forEach((inline) => {
      if (inline.closest(".katex-display")) return; // already handled
      const ann = inline.querySelector('annotation[encoding="application/x-tex"]');
      if (!ann) return;
      let tex = ann.textContent || "";
      tex = tex.replace(/\u00A0/g, " ");
      const wrapper = `${tex}`;
      const repl = document.createElement("span");
      repl.textContent = wrapper;
      inline.replaceWith(repl);
    });

    // Optional fallbacks: if any platform embeds data-tex on nodes.
    root.querySelectorAll("[data-tex]").forEach((el) => {
      if (el.dataset._texHandled) return;
      const tex = el.getAttribute("data-tex");
      if (!tex) return;
      const display =
        el.getAttribute("data-display") === "true" ||
        el.classList.contains("display-math");
      const wrapper = display ? `\n\n\n${tex}\n\n\n` : `${tex}`;
      const repl = document.createElement("span");
      repl.textContent = wrapper;
      el.replaceWith(repl);
    });
  }

  // ---------- Image fixes ----------
  function fixImages(root) {
    root.querySelectorAll("img").forEach((img) => {
      const actual =
        img.getAttribute("data-actualsrc") ||
        img.getAttribute("data-original") ||
        img.getAttribute("data-src") ||
        img.getAttribute("src");
      if (actual) img.setAttribute("src", actual);
      // If figure/figcaption structure is used, prefer figcaption as alt
      const fig = img.closest("figure");
      if (fig) {
        const cap = fig.querySelector("figcaption");
        if (cap && !img.getAttribute("alt")) {
          img.setAttribute("alt", cap.textContent.trim());
        }
      }
    });
  }

  // ---------- Cleanup ----------
  function cleanClone(root) {
    // Drop script/style/svg/noscript and ad/recommendation blocks
    root.querySelectorAll("script, style, svg, noscript").forEach((n) => n.remove());
    // Remove “read more” splitters if any
    root.querySelectorAll(".RichText .ztext-empty-paragraph").forEach((n) => n.remove());
    // Unwrap figures to avoid odd markdown around captions
    root.querySelectorAll("figure").forEach((fig) => {
      // Keep the image, drop wrapper
      if (fig.querySelector("img")) unwrap(fig);
    });
    // Convert &nbsp; to spaces in text nodes (helps markdown cleanliness)
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach((t) => (t.nodeValue = t.nodeValue.replace(/\u00A0/g, " ")));
  }

  // ---------- Markdown conversion ----------
  function toMarkdown(rootNode) {
    const turndownService = new TurndownService({
      codeBlockStyle: "fenced",
      headingStyle: "atx",
      bulletListMarker: "-",
      emDelimiter: "*",
      hr: "---",
      br: "  \n",
    });

    // GFM for tables, strikethrough, task lists, autolinks, etc.
    if (window.turndownPluginGfm) {
      turndownService.use(turndownPluginGfm.gfm);
    }

    // Preserve line breaks inside paragraphs better for Chinese text
    turndownService.addRule("keep-soft-breaks", {
      filter: "br",
      replacement: () => "  \n",
    });

    // Keep <sub>/<sup> as LaTeX-ish when useful
    turndownService.addRule("subsup", {
      filter: ["sub", "sup"],
      replacement: function (content, node) {
        if (node.nodeName === "SUB") return `~${content}~`;
        if (node.nodeName === "SUP") return `^${content}^`;
        return content;
      },
    });

    // Avoid turndown escaping our math markers by doing math replacement *before* this step.
    return turndownService.turndown(rootNode);
  }

  // ---------- Packaging and download ----------
  function buildFrontMatter() {
    const title = getTitle();
    const author = getAuthor();
    const url = location.href;
    const now = new Date();
    const iso = now.toISOString();

    const q = (s) =>
      (s || "")
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, " ");

    return (
      `---\n` +
      `title: "${q(title)}"\n` +
      (author ? `author: "${q(author)}"\n` : "") +
      `url: "${q(url)}"\n` +
      `exported_at: "${iso}"\n` +
      `source: "Zhihu Zhuanlan"\n` +
      `---\n\n`
    );
  }

  function downloadMarkdown(filename, content) {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  // ---------- Main export flow ----------
  async function exportArticle() {
    const root = getArticleRoot();
    if (!root) {
      alert("Could not find article content yet. Try again after the page fully loads.");
      return;
    }

    // Clone the article so we don't mutate the page
    const clone = root.cloneNode(true);

    // Fix images and clean clutter
    fixImages(clone);
    cleanClone(clone);

    // Restore math → replace KaTeX rendered nodes with raw LaTeX markers
    replaceKatexWithTex(clone);

    // Convert to Markdown
    const front = buildFrontMatter();
    const bodyMD = toMarkdown(clone);
    let md = front + bodyMD + "\n";
    md = normalizeNumberedHeadings(md);
    md = stripZhidaLinks(md);
    md = deescapeBackslashes(md);
    md = unescapeUnderscores(md);
    md = unescapeSquareBrackets(md);

    // Download
    const title = sanitizeFilename(getTitle() || "zhihu-article");
    downloadMarkdown(`${title}.md`, md);
  }

  // ---------- UI ----------
  function ensureButton() {
    if (document.getElementById("zhihu-md-export-btn")) return;

    const btn = document.createElement("button");
    btn.id = "zhihu-md-export-btn";
    btn.textContent = "Export Markdown";
    btn.title = "Export this article to Markdown (with LaTeX)";
    btn.addEventListener("click", exportArticle, false);
    document.body.appendChild(btn);

    GM_addStyle(`
      #zhihu-md-export-btn {
        position: fixed;
        right: 18px;
        bottom: 20px;
        z-index: 99999;
        padding: 10px 14px;
        border-radius: 10px;
        border: none;
        font-size: 14px;
        cursor: pointer;
        background: #0a7aff;
        color: white;
        box-shadow: 0 6px 18px rgba(10,122,255,0.25);
      }
      #zhihu-md-export-btn:hover {
        filter: brightness(1.05);
        transform: translateY(-1px);
      }
    `);

    // Also expose a menu command (Tampermonkey icon)
    try {
      GM_registerMenuCommand("Export Zhihu post to Markdown", exportArticle);
    } catch (_) {}
  }

  // Some Zhihu pages are SPA; observe DOM and URL changes.
  function installObservers() {
    // Button installer observer
    const obs = new MutationObserver(() => {
      if (getArticleRoot()) ensureButton();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    // Also re-check on popstate (back/forward navigation)
    window.addEventListener("popstate", () => {
      setTimeout(ensureButton, 300);
    });
  }

  // ---------- Bootstrap ----------
  (async function init() {
    installObservers();
    // Try a few times early on to place the button quickly
    for (let i = 0; i < 10; i++) {
      if (getArticleRoot()) break;
      await sleep(200);
    }
    ensureButton();
  })();
})();
