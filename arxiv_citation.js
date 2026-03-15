// ==UserScript==
// @name         arXiv Citation Count from Semantic Scholar
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Display citation count from Semantic Scholar on arXiv abstract pages
// @author       Claude
// @match        https://arxiv.org/abs/*
// @grant        GM_xmlhttpRequest
// @connect      api.semanticscholar.org
// ==/UserScript==

(function() {
    'use strict';

    // Extract arXiv ID from the URL
    function getArxivId() {
        const path = window.location.pathname;
        const match = path.match(/\/abs\/(.+)/);
        if (match) {
            // Remove version suffix if present (e.g., 2301.00001v2 -> 2301.00001)
            return match[1].replace(/v\d+$/, '');
        }
        return null;
    }

    // Create the citation display element
    function createCitationElement() {
        const container = document.createElement('div');
        container.id = 'semantic-scholar-citations';
        container.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-left: 12px;
            padding: 4px 10px;
            background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
            border-radius: 4px;
            font-size: 13px;
            color: white;
            font-weight: 500;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        `;

        const icon = document.createElement('span');
        icon.innerHTML = '📚';
        icon.style.fontSize = '14px';

        const label = document.createElement('span');
        label.textContent = 'Citations: ';

        const count = document.createElement('span');
        count.id = 'citation-count';
        count.textContent = 'Loading...';
        count.style.fontWeight = '700';

        container.appendChild(icon);
        container.appendChild(label);
        container.appendChild(count);

        return container;
    }

    // Insert the citation element into the page
    function insertCitationElement(element) {
        // Try to find the title element on the abstract page
        const titleElement = document.querySelector('.title');
        if (titleElement) {
            // Insert after the title
            titleElement.parentNode.insertBefore(element, titleElement.nextSibling);
            element.style.marginTop = '10px';
            element.style.marginBottom = '10px';
            return true;
        }

        // Alternative: insert in the header area
        const header = document.querySelector('.abs-meta');
        if (header) {
            header.insertBefore(element, header.firstChild);
            element.style.marginBottom = '15px';
            return true;
        }

        return false;
    }

    // Fetch citation count from Semantic Scholar API
    function fetchCitationCount(arxivId) {
        const apiUrl = `https://api.semanticscholar.org/graph/v1/paper/arXiv:${arxivId}?fields=citationCount,url`;

        GM_xmlhttpRequest({
            method: 'GET',
            url: apiUrl,
            headers: {
                'Accept': 'application/json'
            },
            onload: function(response) {
                const countElement = document.getElementById('citation-count');
                const container = document.getElementById('semantic-scholar-citations');

                if (response.status === 200) {
                    try {
                        const data = JSON.parse(response.responseText);
                        const citationCount = data.citationCount;
                        const semanticUrl = data.url;

                        countElement.textContent = citationCount !== null ? citationCount.toLocaleString() : 'N/A';

                        // Make the container clickable to go to Semantic Scholar
                        if (semanticUrl) {
                            container.style.cursor = 'pointer';
                            container.title = 'Click to view on Semantic Scholar';
                            container.addEventListener('click', function() {
                                window.open(semanticUrl, '_blank');
                            });
                            container.addEventListener('mouseenter', function() {
                                this.style.background = 'linear-gradient(135deg, #5a9fe9 0%, #4589cd 100%)';
                            });
                            container.addEventListener('mouseleave', function() {
                                this.style.background = 'linear-gradient(135deg, #4a90d9 0%, #357abd 100%)';
                            });
                        }
                    } catch (e) {
                        countElement.textContent = 'Error';
                        console.error('arXiv Citation Count: Failed to parse response', e);
                    }
                } else if (response.status === 404) {
                    countElement.textContent = 'Not indexed';
                    container.style.background = '#888';
                } else {
                    countElement.textContent = 'Error';
                    container.style.background = '#c44';
                    console.error('arXiv Citation Count: API error', response.status);
                }
            },
            onerror: function(error) {
                const countElement = document.getElementById('citation-count');
                const container = document.getElementById('semantic-scholar-citations');
                countElement.textContent = 'Failed';
                container.style.background = '#c44';
                console.error('arXiv Citation Count: Request failed', error);
            }
        });
    }

    // Main execution
    function main() {
        const arxivId = getArxivId();
        if (!arxivId) {
            console.log('arXiv Citation Count: Could not extract arXiv ID');
            return;
        }

        const citationElement = createCitationElement();
        if (insertCitationElement(citationElement)) {
            fetchCitationCount(arxivId);
        } else {
            console.log('arXiv Citation Count: Could not find suitable insertion point');
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();
