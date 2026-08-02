# TamperMonkey Scripts

A collection of Tampermonkey userscripts for enhancing various websites.

## Scripts

| Script | Description |
| --- | --- |
| [AlphaXiv_to_ArXiv_PDF.js](AlphaXiv_to_ArXiv_PDF.js) | Adds a button on AlphaXiv pages to open the corresponding PDF on arXiv |
| [arXiv_HTML_to_Abstract.js](arXiv_HTML_to_Abstract.js) | Redirects arXiv HTML pages to their abstract pages |
| [arxiv_citation.js](arxiv_citation.js) | Displays citation count from Semantic Scholar on arXiv abstract pages |
| [Block_weibo_resou.js](Block_weibo_resou.js) | Hides the hot search/trending panel on Weibo's sidebar |
| [Copy_LaTeX_from_Equations.js](Copy_LaTeX_from_Equations.js) | Click any rendered math equation on ChatGPT or Claude to copy its LaTeX source |
| [DBLP_readable_key.js](DBLP_readable_key.js) | Replaces DBLP BibTeX citation keys with readable ones (e.g., `vaswani2017attention`) and adds a copy button |
| [Weibo_skip_exernal-link_warning.js](Weibo_skip_exernal-link_warning.js) | Auto-redirects Weibo external link warnings to the actual target URL |
| [Zhihu_chuanlan_copy.js](Zhihu_chuanlan_copy.js) | Exports Zhihu Zhuanlan articles as Markdown with LaTeX formulas preserved |
| [arxivsignals-exclude-tags.user.js](arxivsignals-exclude-tags.user.js) | Exclude tags on arxivsignals.io, use option to exclude |

### Enable Userscript Permissions for Copy_LaTeX_from_Equations.js

After installing the script, allow Tampermonkey to run userscripts:

1. Right-click the **Tampermonkey** browser icon and select **Manage Extension**.
2. Enable **Allow User Scripts**.
3. Under **Site access**, allow access to `chatgpt.com` and `claude.ai`, or select **On all sites**.
4. Reload the webpage.

If **Allow User Scripts** is not shown, open `chrome://extensions` (or `edge://extensions`) and enable **Developer mode** in the upper-right corner.
