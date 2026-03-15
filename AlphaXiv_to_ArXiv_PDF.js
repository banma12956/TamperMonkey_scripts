// ==UserScript==
// @name         AlphaXiv to ArXiv PDF
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds a button to go to corresponding PDF on arXiv website when viewing papers on AlphaXiv
// @author       Claude
// @match        https://alphaxiv.org/*
// @match        https://www.alphaxiv.org/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function extractArxivId(url) {
        // AlphaXiv URLs typically follow pattern: alphaxiv.org/abs/XXXX.XXXXX
        const match = url.match(/alphaxiv\.org\/abs\/(\d+\.\d+)/);
        if (match) {
            return match[1];
        }
        return null;
    }

    function createButton(arxivId) {
        const button = document.createElement('a');
        button.href = `https://arxiv.org/pdf/${arxivId}.pdf`;
        button.target = '_blank';
        button.textContent = '📄 ArXiv PDF';
        button.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10000;
            padding: 10px 16px;
            background: linear-gradient(135deg, #b31b1b, #8b0000);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
            cursor: pointer;
        `;

        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        });

        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        });

        return button;
    }

    function init() {
        const currentUrl = window.location.href;
        const arxivId = extractArxivId(currentUrl);

        if (arxivId) {
            const existingButton = document.getElementById('arxiv-pdf-button');
            if (existingButton) {
                existingButton.remove();
            }

            const button = createButton(arxivId);
            button.id = 'arxiv-pdf-button';
            document.body.appendChild(button);
        }
    }

    // Run on page load
    init();

    // Watch for URL changes (for single-page app navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            init();
        }
    }).observe(document, { subtree: true, childList: true });
})();
